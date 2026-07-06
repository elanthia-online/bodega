#!/usr/bin/env ruby
# frozen_string_literal: true

# One-off migration: collapse price-bearing item signatures in
# added_items.json to the new price-free format.
#
# Old signature format: "town:shop:item_name:price"
# New signature format: "town:shop:item_name"
#
# When a shop owner changed an item's price the old code minted a new
# signature, so the same physical item was recorded as "added" more than
# once (5,570 such items at time of writing). This script collapses each
# group of price-variants to a single price-free key, keeping the EARLIEST
# added-date (when the item first appeared).
#
# Legacy numeric-ID keys (e.g. "355750291") are left untouched; the browser
# still resolves those via its ID-based fallback lookup.
#
# removed_items.json is keyed by town name -> array of item objects (it does
# not use signatures), so it needs no migration.
#
# Already run once against docs/data/added_items.json (collapsed 8,444
# duplicate price-variants). Retained for reference.
#
# Usage: ruby automation/tools/one-off/migrate-signatures.rb [path/to/added_items.json]
# Writes a .backup alongside the file before rewriting.

require 'json'
require 'time'

path = ARGV[0] || File.expand_path('../../../docs/data/added_items.json', __dir__)

unless File.exist?(path)
  warn "File not found: #{path}"
  exit 1
end

data = JSON.parse(File.read(path))
unless data.is_a?(Hash)
  warn "Expected a JSON object at #{path}, got #{data.class}"
  exit 1
end

migrated = {}
collapsed = 0
signature_keys = 0

data.each do |key, added_date|
  parts = key.split(':')
  # Only collapse OLD price-bearing signatures: town:shop:item:price, where
  # the trailing component is the numeric price. A new-format key
  # (town:shop:item) or a legacy numeric-ID key is left untouched, so this
  # migration is idempotent and safe to re-run.
  if parts.length >= 4 && parts.last =~ /\A\d+\z/
    signature_keys += 1
    base = parts[0..-2].join(':')

    if migrated.key?(base)
      collapsed += 1
      # Keep the earliest added-date
      existing = migrated[base]
      migrated[base] = [existing, added_date].min_by { |d| Time.parse(d) rescue d }
    else
      migrated[base] = added_date
    end
  else
    # Already new-format, or a legacy numeric-ID key - preserve as-is
    migrated[key] = added_date
  end
end

File.write("#{path}.backup", JSON.pretty_generate(data))
File.write(path, JSON.pretty_generate(migrated))

puts "Migrated #{path}"
puts "  signature keys seen: #{signature_keys}"
puts "  duplicate price-variants collapsed: #{collapsed}"
puts "  total keys: #{data.size} -> #{migrated.size}"
puts "  backup written: #{path}.backup"
