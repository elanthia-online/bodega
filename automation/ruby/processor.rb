#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'pathname'
require 'optparse'
require 'time'
require 'set'
require_relative 'bodega_extractor'

# Bodega Data Processor
# Processes raw data captured by bodega.lic and generates fully processed JSON
# with extracted tags, properties, and metadata for the web application
#
# Also handles added/removed item tracking by comparing current vs previous state

class BodegaProcessor
  RAW_DATA_DIR = Pathname.new("docs/data/raw")
  PROCESSED_DATA_DIR = Pathname.new("docs/data")
  ADDED_ITEMS_FILE = PROCESSED_DATA_DIR + "added_items.json"
  REMOVED_ITEMS_FILE = PROCESSED_DATA_DIR + "removed_items.json"
  PROCESSING_VERSION = "v2.0"

  # Tracking configuration
  REMOVED_MAX_SIZE_MB = 10
  REMOVED_MIN_DAYS = 14
  REMOVED_MAX_DAYS = 180
  REMOVED_MAX_NEW_ITEMS = 750  # Server reboot safeguard

  # Weapon skills for type detection
  WEAPON_SKILLS = %w[
    edged\ weapons
    blunt\ weapons
    two\ handed\ weapons
    twohanded\ weapons
    polearm\ weapons
    ranged\ weapons
    thrown\ weapons
    brawling
  ].freeze

  # Container keywords for name-based detection
  CONTAINER_KEYWORDS = /\b(bag|sack|backpack|pouch|satchel|chest|strongbox|trunk|basket|sheath|scabbard|harness|bandolier)\b/i
  ARMOR_EXCLUSIONS = /robe|armor|mail|scale|chain|plate|leather|hide|skin/i

  # Jewelry keywords
  JEWELRY_KEYWORDS = /\b(ring|necklace|bracelet|earring|pendant|amulet|brooch|pin)\b/i

  def initialize(town: nil)
    @town_filter = town
    @stats = { processed: 0, failed: 0, skipped: 0 }

    # Tracking state
    @added_items = load_added_items
    @removed_items = load_removed_items
    @previous_signatures = {}  # town => Set of signatures
    @current_signatures = {}   # town => { signature => item_data }
    @items_added_this_run = 0
    @items_removed_this_run = 0
  end

  def run
    puts "Starting Bodega data processing"

    # Load previous state for tracking before processing
    load_previous_state

    # Process all raw files
    process_raw_files

    # Update tracking based on changes detected
    update_tracking

    # Save tracking files
    save_added_items
    save_removed_items

    puts "Processing complete: #{@stats[:processed]} processed, " \
         "#{@stats[:skipped]} skipped, #{@stats[:failed]} failed"
    puts "Tracking: #{@items_added_this_run} items added, #{@items_removed_this_run} items removed"

    # Exit with error if any failed
    exit(1) if @stats[:failed] > 0
  end

  def process_raw_files
    raw_files = Dir[RAW_DATA_DIR + "*.json"]

    # Filter by town if specified (partial match)
    if @town_filter
      filter = safe_string(@town_filter)
      raw_files = raw_files.select do |f|
        basename = File.basename(f, '.json')
        safe_string(basename).include?(filter)
      end
      puts "Filtering to town: #{@town_filter} (#{raw_files.size} files matched)"
    end

    raw_files.each do |raw_file|
      basename = File.basename(raw_file)
      processed_file = PROCESSED_DATA_DIR + basename
      process_file(raw_file, processed_file)
    end
  end

  def process_file(raw_file, processed_file)
    puts "Processing #{File.basename(raw_file)}..."

    begin
      raw_data = JSON.parse(File.read(raw_file), symbolize_names: true)

      # Process the data
      processed_data = process_town_data(raw_data)

      # Add processing metadata
      processed_data[:processed_at] = Time.now.utc.strftime("%Y-%m-%d %H:%M:%S UTC")
      processed_data[:processing_version] = PROCESSING_VERSION

      # Write processed data
      File.write(processed_file, JSON.pretty_generate(processed_data))

      puts "✓ Processed #{File.basename(raw_file)}"
      @stats[:processed] += 1

    rescue => e
      puts "✗ Failed to process #{File.basename(raw_file)}: #{e.message}"
      puts e.backtrace.first(5).join("\n")
      @stats[:failed] += 1
    end
  end

  def process_town_data(raw_data)
    processed = raw_data.dup
    town = raw_data[:town]

    # Process each shop and track items
    processed[:shops] = raw_data[:shops].map do |shop|
      processed_shop = process_shop(shop)

      # Track all items in this shop for added/removed detection
      if town
        preamble = shop[:preamble]
        processed_shop[:inv]&.each do |room|
          room[:items]&.each do |item|
            track_current_item(town, preamble, item)
          end
        end
      end

      processed_shop
    end

    # Remove raw format marker
    processed.delete(:format_version)

    processed
  end

  def process_shop(shop)
    processed_shop = shop.dup

    # Process inventory
    processed_shop[:inv] = shop[:inv].map do |room|
      process_room(room)
    end

    # Extract shop_owner if not present
    unless processed_shop[:shop_owner]
      processed_shop[:shop_owner] = extract_shop_owner(shop[:preamble])
    end

    processed_shop
  end

  def process_room(room)
    processed_room = room.dup

    # Process items
    processed_room[:items] = room[:items].map do |item|
      process_item(item)
    end

    processed_room
  end

  def process_item(item)
    # Check if this is raw format or already processed
    if item[:raw_inspect]
      # Raw format - apply extraction
      extracted = Bodega::Extractor.of(item[:raw_inspect])

      # Build details object
      details = {
        raw: extracted[:raw],
        tags: extracted[:tags],
        cost: item[:browse_price] || extracted[:cost],
      }

      # Add all extracted properties (compact removes nil values)
      details.merge!({
        enchant: extracted[:enchant],
        material: extracted[:material],
        material_detail: extracted[:material_detail],
        skill: extracted[:skill],
        flare: extracted[:flare],
        weight: extracted[:weight],
        worn: extracted[:worn],
        activator: extracted[:activator],
        spell: extracted[:spell],
        charges: extracted[:charges],
        armor_type: extracted[:armor_type],
        td_bonus: extracted[:td_bonus],
        db_bonus: extracted[:db_bonus],
        sanctify: extracted[:sanctify],
        ensorcell: extracted[:ensorcell],
        dmg_padding: extracted[:dmg_padding],
        crit_padding: extracted[:crit_padding],
        dmg_weighting: extracted[:dmg_weighting],
        crit_weighting: extracted[:crit_weighting],
        sighting: extracted[:sighting],
        forged_by: extracted[:forged_by],
        forged_avd: extracted[:forged_avd],
        enhancives: extracted[:enhancives],
        gemstone_properties: extracted[:gemstone_properties],
        gemstone_bound_to: extracted[:gemstone_bound_to],
      }.compact)

      # Add advanced processing (previously done in browser)
      add_advanced_properties(details, extracted, item[:name])

      {
        id: item[:id],
        name: item[:name],
        quantity: item[:quantity],
        details: details
      }.compact
    elsif item[:details]&.[](:raw)
      # Old format (details.raw exists) - apply advanced processing
      details = item[:details]
      # Build extracted hash from existing details for add_advanced_properties
      extracted = {
        skill: details[:skill],
        dmg_padding: details[:dmg_padding],
        crit_padding: details[:crit_padding],
        dmg_weighting: details[:dmg_weighting],
        crit_weighting: details[:crit_weighting],
        sighting: details[:sighting],
        forged_avd: details[:forged_avd],
      }
      add_advanced_properties(details, extracted, item[:name])
      item
    else
      # Unknown format - pass through
      item
    end
  end

  def add_advanced_properties(details, extracted, item_name = nil)
    raw_text = details[:raw].join("\n")
    raw_lines = details[:raw]

    # === Container detection ===
    if raw_text =~ /can store a (.*?) amount/i
      details[:capacity_level] = $1.downcase
      details[:is_container] = true
      details[:tags] << :container unless details[:tags].include?(:container)
    end

    # Container by name (if not already detected and not armor)
    if !details[:is_container] && item_name
      if CONTAINER_KEYWORDS.match?(item_name) && !ARMOR_EXCLUSIONS.match?(item_name)
        details[:is_container] = true
      end
    end

    # === Shield detection ===
    if raw_text =~ /is a (small|medium|large|tower|parma|buckler) shield/i
      details[:shield_type] = $1.downcase
      details[:is_shield] = true
    elsif raw_text =~ /shield that protects/i
      details[:is_shield] = true
    end

    # === Weapon detection (based on skill) ===
    if extracted[:skill]
      skill_lower = extracted[:skill].downcase
      if WEAPON_SKILLS.any? { |ws| skill_lower.include?(ws) }
        details[:is_weapon] = true
        details[:weapon_type] = extracted[:skill]
      elsif skill_lower == 'shield use'
        details[:is_shield] = true
      elsif skill_lower == 'armor use'
        details[:is_armor] = true
      end
    end

    # === Armor detection ===
    armor_patterns = [
      /is (.*?) armor that/i,
      /The .* is (.*?) armor/i,
      /covers.*torso/i,
      /covers.*chest/i,
      /covers.*body/i,
      /protects.*body/i,
      /armor.*covers/i,
      /robe.*covers/i,
      /robes.*cover/i
    ]
    armor_patterns.each do |pattern|
      if (match = raw_text.match(pattern))
        details[:is_armor] = true
        if match[1] && !details[:armor_type]
          armor_type = match[1].downcase
          details[:armor_type] = armor_type == 'miscellaneous' ? 'accessory' : armor_type
        end
        break
      end
    end

    # Normalize existing armor_type
    if details[:armor_type]&.downcase&.include?('miscellaneous')
      details[:armor_type] = 'accessory'
    end

    # === Wear location parsing ===
    raw_lines.each do |line|
      break if details[:wear_location] # Already found

      wear_patterns = [
        [/covers the (.*?)[\.,]/i, '$1'],
        [/worn (.*?)[\.,]/i, '$1'],
        [/around the (.*?)[\.,]/i, '$1'],
        [/over the (.*?)[\.,]/i, '$1'],
        [/put on.*as a (helm|hat|cap|crown)/i, 'head'],
        [/put on.*as (boots|shoes|sandals)/i, 'feet'],
        [/put on.*as (gloves|gauntlets)/i, 'hands'],
        [/put on.*as a (belt)/i, 'waist'],
        [/hung around.*as (necklace|pendant)/i, 'neck'],
        [/slid onto.*as a (ring)/i, 'finger'],
        [/attached to.*as a (bracelet)/i, 'wrist'],
        [/attached to.*as an (anklet)/i, 'ankle'],
        [/hung from.*as.*earring/i, 'earlobe'],
        [/draped from.*as a (cloak|cape)/i, 'shoulders'],
        [/slung over.*as a (shield)/i, 'shoulder'],
        [/worked into.*as (armor)/i, 'torso'],
        [/put over.*as an (apron)/i, 'front'],
        [/put in.*as.*barrette/i, 'hair'],
        [/attached to.*as.*pouch/i, 'belt']
      ]

      wear_patterns.each do |pattern, location|
        if (match = line.match(pattern))
          if location == '$1'
            details[:wear_location] = match[1]&.strip
          else
            details[:wear_location] = location
          end
          break
        end
      end
    end

    # === Flares parsing ===
    details[:flares] = []
    # Add existing flare from extractor
    details[:flares] << extracted[:flare] if extracted[:flare]

    raw_lines.each do |line|
      next if line.match?(/^Description:/i) # Skip gemstone descriptions

      if line.match?(/infused.*power/i) ||
         line.match?(/infused.*mana/i) ||
         line.match?(/\b(fire|ice|lightning|vacuum|impact|acid|plasma|steam|grapple|unbalance|disrupt|disruption)\s+flares?\b/i) ||
         line.match?(/holy.*fire/i) ||
         line.match?(/blessed.*undead/i)

        # Extract the flare description
        if (infused_match = line.match(/has been infused with (.+)\.?$/i))
          flare_text = infused_match[1].sub(/\.$/, '')
        else
          flare_text = line.strip
        end

        # Don't add duplicates
        unless details[:flares].any? { |f| f&.downcase == flare_text.downcase }
          details[:flares] << flare_text
        end
      end
    end

    # Remove flares array if empty, keep single flare for backwards compat
    if details[:flares].empty?
      details.delete(:flares)
    elsif details[:flares].size == 1
      # Keep both flare (single) and flares (array) for compatibility
    end

    # === Jewelry detection ===
    if raw_text.match?(/is.*jewelry/i) || (item_name && JEWELRY_KEYWORDS.match?(item_name))
      details[:is_jewelry] = true
    end

    # === Gemstone detection ===
    if details[:gemstone_properties]&.any?
      details[:is_gemstone] = true
    end

    # === Blessing detection ===
    if raw_text.match?(/blessed/i) || raw_text.match?(/holy/i)
      details[:blessing] = 'holy'
    end

    # === Sighting (ranged weapons) ===
    # Handle case where sighting exists but tier is unknown
    if extracted[:sighting]
      details[:sighting] = extracted[:sighting]
    elsif raw_text.match?(/sighted to assist in aiming/i)
      details[:sighting] = 'unknown'
    end

    # === Weighting (weapons) ===
    # Handle case where weighting exists but tier is unknown, also detect temporary
    if raw_text.match?(/weighted to inflict more damage/i)
      details[:dmg_weighting] ||= extracted[:dmg_weighting] || 'unknown'
      details[:temporary_dmg_weighting] = true if raw_text.match?(/temporarily weighted to inflict more damage/i)
    end
    if raw_text.match?(/weighted to inflict more critical/i)
      details[:crit_weighting] ||= extracted[:crit_weighting] || 'unknown'
      details[:temporary_crit_weighting] = true if raw_text.match?(/temporarily weighted to inflict more critical/i)
    end

    # === Padding (armor) ===
    # Handle case where padding exists but tier is unknown, also detect temporary
    if raw_text.match?(/padded to lessen the damage/i)
      details[:dmg_padding] ||= extracted[:dmg_padding] || 'unknown'
      details[:temporary_dmg_padding] = true if raw_text.match?(/temporarily padded to lessen the damage/i)
    end
    if raw_text.match?(/padded against critical/i)
      details[:crit_padding] ||= extracted[:crit_padding] || 'unknown'
      details[:temporary_crit_padding] = true if raw_text.match?(/temporarily padded against critical/i)
    end

    # === Forged quality ===
    if extracted[:forged_avd]
      avd = extracted[:forged_avd].to_i
      details[:forged_quality] = case avd
        when 3 then 'perfect'
        when 2 then 'superior'
        when 1 then 'elegant'
        when 0 then 'fine'
        when -1 then 'simple'
        when -2 then 'crude'
        when -3 then 'flimsy'
        else 'unknown'
      end
    end

    # === Determine primary item_type ===
    # Priority: Weapon > Armor > Shield > Container > Jewelry > Gemstone
    details[:item_type] = if details[:is_weapon]
      'weapon'
    elsif details[:is_armor]
      'armor'
    elsif details[:is_shield]
      'shield'
    elsif details[:is_container]
      'container'
    elsif details[:is_jewelry]
      'jewelry'
    elsif details[:is_gemstone]
      'gemstone'
    else
      nil
    end
  end

  def extract_shop_owner(preamble)
    return 'unknown' unless preamble
    match = preamble.match(/^(.*?)'s?\s+Shop\s+is\s+located/i) ||
            preamble.match(/^(.*?)\s+is\s+located/i)
    match ? match[1].strip : 'unknown'
  end

  # ============================================
  # Item Tracking Methods
  # ============================================

  def load_added_items
    return {} unless File.exist?(ADDED_ITEMS_FILE)

    begin
      JSON.parse(File.read(ADDED_ITEMS_FILE))
    rescue JSON::ParserError => e
      puts "Warning: Failed to parse added_items.json: #{e.message}"
      {}
    end
  end

  def load_removed_items
    return {} unless File.exist?(REMOVED_ITEMS_FILE)

    begin
      JSON.parse(File.read(REMOVED_ITEMS_FILE))
    rescue JSON::ParserError => e
      puts "Warning: Failed to parse removed_items.json: #{e.message}"
      {}
    end
  end

  def load_previous_state
    # Load all previously processed town files to build signature maps
    processed_files = Dir[PROCESSED_DATA_DIR + "*.json"].reject do |f|
      basename = File.basename(f)
      # Skip non-town files
      %w[added_items.json removed_items.json shop_mapping.json].include?(basename)
    end

    processed_files.each do |file|
      begin
        data = JSON.parse(File.read(file), symbolize_names: true)
        town = data[:town]
        next unless town

        @previous_signatures[town] = Set.new

        data[:shops]&.each do |shop|
          preamble = shop[:preamble]
          shop[:inv]&.each do |room|
            room[:items]&.each do |item|
              sig = create_item_signature(town, preamble, item)
              @previous_signatures[town].add(sig) if sig
            end
          end
        end
      rescue => e
        puts "Warning: Could not load previous state from #{File.basename(file)}: #{e.message}"
      end
    end

    puts "Loaded previous state: #{@previous_signatures.values.map(&:size).sum} item signatures across #{@previous_signatures.size} towns"
  end

  def create_item_signature(town, preamble, item)
    # Create a unique signature for the item based on stable attributes
    # Matches the format used by data-loader.js
    return nil unless item && (item[:name] || item['name'])

    item_name = item[:name] || item['name']
    details = item[:details] || item['details'] || {}
    price = details[:cost] || details['cost'] || 0

    shop_name = extract_shop_name_from_preamble(preamble)

    safe_town = safe_string(town)
    safe_shop = safe_string(shop_name)
    safe_item = item_name.to_s.downcase.strip
    safe_price = price.to_s

    "#{safe_town}:#{safe_shop}:#{safe_item}:#{safe_price}"
  end

  def extract_shop_name_from_preamble(preamble)
    return 'unknown' unless preamble

    match = preamble.to_s.match(/^(.*?)'s?\s+Shop\s+is\s+located/i) ||
            preamble.to_s.match(/^(.*?)\s+is\s+located/i)

    match ? match[1].strip : 'unknown'
  end

  def safe_string(str)
    return '' unless str
    str.to_s.downcase.strip.gsub(/[^a-z0-9]+/, '_').gsub(/^_|_$/, '')
  end

  def track_current_item(town, preamble, item)
    # Track an item from the current processing run
    sig = create_item_signature(town, preamble, item)
    return unless sig

    @current_signatures[town] ||= {}
    @current_signatures[town][sig] = {
      item: item,
      preamble: preamble
    }
  end

  def update_tracking
    current_time = Time.now.utc.iso8601

    # Process each town that has current data
    @current_signatures.each do |town, current_items|
      previous_sigs = @previous_signatures[town] || Set.new
      current_sigs = Set.new(current_items.keys)

      # Find new items (in current but not in previous)
      new_sigs = current_sigs - previous_sigs
      new_sigs.each do |sig|
        # Only add if not already tracked
        unless @added_items.key?(sig)
          @added_items[sig] = current_time
          @items_added_this_run += 1
        end
      end

      # Find removed items (in previous but not in current)
      removed_sigs = previous_sigs - current_sigs
      removed_sigs.each do |sig|
        # We need to find the item data from previous processed file
        track_removed_item(town, sig, current_time)
      end
    end

    # Also check for towns that existed before but have no current data
    # (This handles the case where a town file wasn't processed this run)
    @previous_signatures.each do |town, previous_sigs|
      next if @current_signatures.key?(town)  # Already handled above

      # If we processed this town's raw file but got no items, they're all removed
      raw_file = RAW_DATA_DIR + "#{safe_string(town)}.json"
      if File.exist?(raw_file) && File.mtime(raw_file) > (Time.now - 3600)
        # Raw file was recently modified - items may have been removed
        previous_sigs.each do |sig|
          track_removed_item(town, sig, current_time)
        end
      end
    end

    puts "Tracking update: #{@items_added_this_run} new, #{@items_removed_this_run} removed"
  end

  def track_removed_item(town, signature, timestamp)
    # Find the item in the previous processed data
    processed_file = find_processed_file_for_town(town)
    return unless processed_file && File.exist?(processed_file)

    begin
      data = JSON.parse(File.read(processed_file), symbolize_names: true)

      data[:shops]&.each do |shop|
        preamble = shop[:preamble]
        shop[:inv]&.each do |room|
          room[:items]&.each do |item|
            sig = create_item_signature(town, preamble, item)
            next unless sig == signature

            # Found the item - add to removed items
            removed_item = {
              'id' => item[:id]&.to_s || item['id']&.to_s,
              'name' => item[:name] || item['name'],
              'details' => deep_stringify_keys(item[:details] || item['details'] || {}),
              'removed_date' => timestamp,
              'last_seen_shop' => extract_shop_name_from_preamble(preamble),
              'town' => town
            }

            @removed_items[town] ||= []
            @removed_items[town] << removed_item
            @items_removed_this_run += 1
            return  # Found it, we're done
          end
        end
      end
    rescue => e
      puts "Warning: Could not find removed item in #{town}: #{e.message}"
    end
  end

  def find_processed_file_for_town(town)
    # Find the processed file for a given town name
    safe_town = safe_string(town)
    processed_files = Dir[PROCESSED_DATA_DIR + "*.json"]

    processed_files.find do |f|
      basename = File.basename(f, '.json')
      basename == safe_town || safe_string(basename) == safe_town
    end
  end

  def deep_stringify_keys(hash)
    return hash unless hash.is_a?(Hash)
    hash.transform_keys(&:to_s).transform_values do |v|
      v.is_a?(Hash) ? deep_stringify_keys(v) : v
    end
  end

  def save_added_items
    return if @added_items.empty?

    # Clean up items with invalid timestamps
    @added_items = @added_items.select do |_sig, timestamp|
      begin
        Time.parse(timestamp)
        true
      rescue
        false
      end
    end

    begin
      File.write(ADDED_ITEMS_FILE, JSON.pretty_generate(@added_items))
      puts "Saved added_items.json with #{@added_items.size} items"
    rescue => e
      puts "Failed to save added_items.json: #{e.message}"
    end
  end

  def save_removed_items
    return if @removed_items.empty?

    # Server reboot safeguard: reject if too many new items
    if @items_removed_this_run > REMOVED_MAX_NEW_ITEMS
      puts "SAFEGUARD: Rejecting #{@items_removed_this_run} removed items (threshold: #{REMOVED_MAX_NEW_ITEMS})"
      puts "This likely indicates a server reboot with ID reset - keeping existing data"
      return
    end

    # Clean old items by max age
    clean_removed_items_by_age

    # Clean by size if needed
    clean_removed_items_by_size

    begin
      File.write(REMOVED_ITEMS_FILE, JSON.pretty_generate(@removed_items))
      total_items = @removed_items.values.flatten.size
      puts "Saved removed_items.json with #{total_items} items across #{@removed_items.size} towns"
    rescue => e
      puts "Failed to save removed_items.json: #{e.message}"
    end
  end

  def clean_removed_items_by_age
    max_cutoff = Time.now.utc - (REMOVED_MAX_DAYS * 24 * 60 * 60)

    @removed_items.each do |town, items|
      @removed_items[town] = items.select do |item|
        begin
          removed_date = item['removed_date'] || item[:removed_date]
          Time.parse(removed_date) >= max_cutoff
        rescue
          false
        end
      end
    end

    # Remove empty town entries
    @removed_items.delete_if { |_town, items| items.empty? }
  end

  def clean_removed_items_by_size
    # Check current size
    temp_json = JSON.generate(@removed_items)
    size_mb = temp_json.bytesize / (1024.0 * 1024.0)

    return if size_mb <= REMOVED_MAX_SIZE_MB

    puts "removed_items.json is #{size_mb.round(2)}MB, trimming to #{REMOVED_MAX_SIZE_MB}MB"

    min_cutoff = Time.now.utc - (REMOVED_MIN_DAYS * 24 * 60 * 60)

    # Get all items sorted by date (newest first)
    all_items = []
    @removed_items.each do |town, items|
      items.each do |item|
        item['town'] ||= town
        all_items << item
      end
    end

    all_items.sort_by! do |item|
      begin
        Time.parse(item['removed_date'] || item[:removed_date] || '1970-01-01')
      rescue
        Time.at(0)
      end
    end.reverse!

    # Calculate target count
    reduction_ratio = REMOVED_MAX_SIZE_MB / size_mb
    target_count = (all_items.size * reduction_ratio * 0.9).to_i

    # Keep newest items within min_days
    items_to_keep = all_items.select do |item|
      begin
        removed_date = item['removed_date'] || item[:removed_date]
        Time.parse(removed_date) >= min_cutoff
      rescue
        false
      end
    end

    items_to_keep = items_to_keep.first(target_count) if items_to_keep.size > target_count

    # Rebuild by town
    @removed_items = {}
    items_to_keep.each do |item|
      town = item['town'] || 'unknown'
      @removed_items[town] ||= []
      @removed_items[town] << item
    end

    new_json = JSON.generate(@removed_items)
    new_size_mb = new_json.bytesize / (1024.0 * 1024.0)
    puts "Trimmed removed_items.json from #{size_mb.round(2)}MB to #{new_size_mb.round(2)}MB"
  end
end

# Parse command line options
options = { town: nil }
OptionParser.new do |opts|
  opts.banner = "Usage: processor.rb [options]"

  opts.on("--town=TOWN", "Process only a specific town (e.g., wehnimers_landing)") do |t|
    options[:town] = t
  end
end.parse!

# Run processor
processor = BodegaProcessor.new(town: options[:town])
processor.run
