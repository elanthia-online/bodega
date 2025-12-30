#!/usr/bin/env ruby
# frozen_string_literal: true

# Bodega Data Extractor
# Extracts structured properties and tags from raw SHOP INSPECT output
#
# This module contains the core extraction logic used by both:
# - bodega.lic (during in-game scanning, if not using raw mode)
# - processor.rb (server-side processing of raw data)

# Polyfill for MatchData#to_h with special processing
# (symbolizes keys, strips values, converts integer strings)
class ::String
  def is_i?
    !!(self =~ /\A[-+]?[0-9]+\z/)
  end
end

class ::MatchData
  def to_h
    Hash[self.names.map(&:to_sym).zip(self.captures.map do |capture|
      next nil if capture.nil?
      stripped = capture.strip
      stripped.is_i? ? stripped.to_i : stripped
    end)]
  end
end

module Bodega
  class Extractor
    BLACKLIST = Regexp.union(
      %r[^There is nothing there to read\.$],
      %r[^You carefully inspect],
      %r[^You get no sense of whether or not (.*?) may be further lightened.],
      %r[there is no recorded information on that item],
      %r[^You determine that you could not wear the shard\.],
      %r[^You see nothing unusual\.$],
      %r[^It imparts no bonus more than usual\.$],
      %r[^It is difficult to see the (.*?) clearly from this distance\.]
    )

    ENHANCIVE = {
      boost: %r[^It provides a boost of (?<boost>\d+) to (?<ability>.*?)\.],
      level_req: %r[^This enhancement may not be used by adventurers who have not trained (?<level>\d+) times.],
    }

    BOOLS = {
      max_deep: %r[pockets could not possibly get any deeper],
      max_light: %r[^You can tell that the (?:.*?) is as light as it can get],
      purpose: %r[appears to serve some purpose],
      deepenable: %r[you might be able to have a talented merchant deepen its pockets for you],
      lightenable: %r[You might be able to have a talented merchant lighten (.*?) for you.],
      persists: %r[^It will persist after its last charge is depleted|^It will persist after its last enhancive charge],
      crumbly: %r[but crumble after its last enhancive charge is depleted|^It will crumble into dust after its last charge is depleted\.$|^It will disintegrate after its last charge is depleted\.$],
      small: %r[^It is a small item, under a pound],
      imbeddable: %r[^It is a magical item which could be imbedded with a spell],
      imbedded: %r[^It is currently imbedded with|has been imbedded|currently imbedded],
      not_wearable: %r[^You determine that you could not wear],
      holy: %r[^It is a holy item\.],
      is_gemstone: %r[^The jewel appears to be a powerful relic that can convey wondrous abilities on its wielder],
      # Combat Modifiers
      spiked: %r[It is spiked\.],
      # Resistances
      magic_resistant: %r[It is magic resistant\.],
      # Special Features
      scripted: %r[Additional scripts have been applied|has a Custom.*script|Shield Cape Collection|It is Tier \d+|Blink Weapon|briar flare weapon|has some unknown \(scripted\) benefit],
      flourish: %r[It has the .* Flourish],
      # Holy Fire (separate from sanctify tier)
      holy_fire: %r[permanent Holy Fire flares],
      # Greater Undead Bane (GUB) - appears with sanctified weapons
      gub: %r[provides an additional \+\d+ AS bonus against the undead],
    }

    PROPS = {
      skill: %r[requires skill in (?<skill>.*?) to use effectively\.],
      enchant: %r[^It imparts a bonus of \+(?<enchant>\d+) more than usual\.],
      weight: %r[^It appears to weigh about (?<weight>\d+) pounds.],
      # flare: %r[^It has been infused with the power of an? (?<flare>.*?)\.],
      material: %r[^It looks like this item has been mainly crafted out of (?<material>.*?)\.],
      material_enhanced: %r[^It is predominantly crafted of (?<material>.*?)\.\s*(?:It is (?<material_detail>(?:greater|lesser|pristine) .*?)\.)?],
      cost: %r[will cost (?<cost>\d+) coins\.$],
      worn: %r[The .*? can be worn(?:, slinging it across the |, hanging it from the |, attaching it to the | around the | in the | on the | over(?: the)? )(?<worn>[^.]+)(?=.)],
      activator: %r[^It could be activated by (?<activator>\w+) it\.$],
      spell: %r[^It is currently imbedded with the (?<spell>.*?) spell.],
      charges: %r[The (?:\w+) looks to have (?<charges>.*?) charges remaining\.$|It has (?<charges>.*?) charges remaining.],
      shield_size: %r[Your careful inspection of an ornate villswood shield allows you to conclude that it is a (?<size>\w+) shield that],
      armor_type: %r[ allows you to conclude that it is (?<armor_type>.*?)\.],
      flare: %r[It has been infused with (?<flare>.*?)\.$],
      gemstone_bound_to: %r[jewel is bound to (?<gemstone_bound_to>\w+),],
      # TD Bonus (Target Defense)
      td_bonus: %r[protects against magical attacks with a bonus of (?<td_bonus>\d+)],
      # DB Bonus (Defensive Bonus from shields)
      db_bonus: %r[provides a bonus of \+(?<db_bonus>\d+) to Defensive Strength],
      # Sanctification tier (1-5)
      sanctify: %r[has been sanctified (?<sanctify>\d+) times?],
      # Ensorcell tier (1-5)
      ensorcell: %r[has been ensorcelled (?<ensorcell>\d+) times?],
      # ARMOR: Padding (captures descriptor)
      dmg_padding: %r[(?<dmg_padding>somewhat|fairly|heavily|very heavily|masterfully) padded to lessen the damage],
      crit_padding: %r[(?<crit_padding>somewhat|fairly|heavily|very heavily|masterfully) padded against critical blows],
      # WEAPON: Weighting (captures descriptor)
      dmg_weighting: %r[(?<dmg_weighting>lightly|somewhat|fairly|heavily|very heavily|exceptionally) weighted to inflict more damage],
      crit_weighting: %r[(?<crit_weighting>lightly|somewhat|fairly|heavily|very heavily|exceptionally) weighted to inflict more critical wounds],
      # RANGED: Sighting (captures descriptor, or 'unknown' if no descriptor)
      sighting: %r[(?:(?<sighting>somewhat|fairly|heavily|very heavily) )?(?:It is )?sighted to assist in aiming],
      # FORGED: Quality tier from forging (captures forger name and AvD bonus, can be negative)
      forged_by: %r[It is forged by (?<forged_by>.*?) and has (?:increased|decreased) \((?<forged_avd>[+-]?\d+)\) effectiveness in combat],
    }

    def self.of(details)
      # todo: implement detail extractor
      return new(details).to_h
    end

    attr_reader :props

    def initialize(details)
      @props = { raw: [], tags: [] }
      _extract(details)
    end

    def maybe_raw(line)
      # Always add non-blacklisted lines to raw, regardless of parsing
      return if BLACKLIST.match(line)
      @props[:raw] << line
    end

    def _extract(details)
      # Convert to array for indexed access (needed for jewel property parsing)
      details_array = details.to_a

      details_array.each_with_index do |line, index|
        # Try to parse gemstone properties first (multi-line blocks)
        next if _gemstone_property(details_array, index)

        # Always add to raw (unless blacklisted)
        maybe_raw(line)

        # Then handle single-line patterns for extraction
        _props(line)
        _bools(line)
        _enhancive(line.strip)
      end
    end

    def _bools(line)
      BOOLS.select do |prop, pattern|
        line.match(pattern) and @props[:tags].push(prop)
      end.size > 0
    end

    def _enhancive(line)
      if (boost = line.match(ENHANCIVE[:boost]))
        @props[:enhancives] ||= []
        @props[:enhancives].push(boost.to_h)
        return true
      end

      if (level_req = line.match(ENHANCIVE[:level_req]))
        # Only merge if we have enhancives and the last one exists
        if @props[:enhancives] && @props[:enhancives].last
          @props[:enhancives].last.merge!(level_req.to_h)
        end
        return true
      end

      return false
    end

    def _gemstone_property(lines, index)
      # Parse gemstone property blocks that span multiple lines
      return false unless lines[index].match(/^Property:\s+(.+)$/)

      property = { name: $1.strip }

      # Look for Rarity on next line
      if index + 1 < lines.size && lines[index + 1].match(/^Rarity:\s+(.+)$/)
        property[:rarity] = $1.strip
      end

      # Look for Mnemonic
      if index + 2 < lines.size && lines[index + 2].match(/^Mnemonic:\s+(.+)$/)
        property[:mnemonic] = $1.strip
      end

      # Look for Description (may span multiple lines)
      if index + 3 < lines.size && lines[index + 3].match(/^Description:\s+(.+)$/)
        description = $1.strip

        # Check for continuation on next lines (not starting with known patterns)
        current_index = index + 4
        while current_index < lines.size
          # Stop if we hit another property block or known pattern
          break if lines[current_index].match(/^Property:|^\*|^You note|^The jewel/)
          # Add continuation lines
          unless lines[current_index].strip.empty?
            description += " " + lines[current_index].strip
          end
          current_index += 1
        end

        property[:description] = description
      end

      # Check for activation marker
      if lines.size > index + 4 && lines[index + 4].match(/^\s*\*\s+Activated/)
        property[:activated] = true
      elsif lines.size > index + 5 && lines[index + 5].match(/^\s*\*\s+Activated/)
        property[:activated] = true
      end

      @props[:gemstone_properties] ||= []
      @props[:gemstone_properties] << property

      return true
    end

    def _props(line)
      PROPS.select do |prop, pattern|
        if prop == :worn && line =~ /anywhere on the body/i
          @props[:worn] = "pin"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /around the chest, beneath another garment/i
          @props[:worn] = "undershirt"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /on the feet, beneath shoes or boots/i
          @props[:worn] = "socks"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /slinging it across the shoulders and back/i
          @props[:worn] = "shoulders"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /hanging it from the shoulders/i
          @props[:worn] = "cloak"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /leggings/i
          @props[:worn] = "leggings"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /on the legs/i
          @props[:worn] = "pants"
          true  # Return true to indicate a match was found
        elsif prop == :worn && line =~ /around the legs/i
          @props[:worn] = "legs"
          true  # Return true to indicate a match was found
        elsif (result = line.match(pattern))
          @props.merge!(result.to_h)
          true
        else
          false
        end
      end.size > 0
    end

    def to_h
      @props
    end
  end
end
