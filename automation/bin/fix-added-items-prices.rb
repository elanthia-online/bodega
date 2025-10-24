#!/usr/bin/env ruby
# Script to fix added_items.json entries that have :0 prices
# Looks up actual prices from town JSON files and updates signatures

require 'json'
require 'pathname'

# Helper function matching bodega.lic
def safe_string(text)
  text.to_s.downcase
    .gsub("ta'", "ta_")
    .gsub(/'|,/, "")
    .gsub(/-|\s/, "_")
end

def create_item_signature(town, shop_name, item_name, price)
  safe_town = safe_string(town)
  safe_shop = safe_string(shop_name)
  safe_item = item_name.to_s.downcase.strip
  safe_price = price.to_s

  "#{safe_town}:#{safe_shop}:#{safe_item}:#{safe_price}"
end

def extract_shop_name_from_preamble(preamble)
  return "unknown" unless preamble

  match = preamble.match(/^(.*?)'s?\s+Shop\s+is\s+located/i) ||
          preamble.match(/^(.*?)\s+is\s+located/i)

  match ? match[1].strip : "unknown"
end

def parse_signature(signature)
  # Parse signature like "town:shop:item_name:price"
  parts = signature.split(':')
  return nil if parts.length < 4

  {
    town: parts[0],
    shop: parts[1],
    item_name: parts[2..-2].join(':'), # Handle colons in item names
    price: parts[-1]
  }
end

# Get data directory
data_dir = ARGV[0] ? Pathname.new(ARGV[0]) : Pathname.new('docs/data')
added_items_file = data_dir + "added_items.json"

unless added_items_file.exist?
  puts "ERROR: #{added_items_file} does not exist"
  exit 1
end

puts "Loading added_items.json..."
added_items = JSON.parse(File.read(added_items_file))

puts "Found #{added_items.size} total entries"

# Find entries with :0 price
zero_price_entries = added_items.select do |sig, _ts|
  sig.include?(':') && sig.end_with?(':0')
end

puts "Found #{zero_price_entries.size} entries with :0 price that need fixing"

if zero_price_entries.empty?
  puts "No entries need fixing. Exiting."
  exit 0
end

# Load all town JSON files
town_files = Dir[data_dir + "*.json"].reject do |f|
  f.include?('added_items') || f.include?('removed_items') || f.include?('shop_mapping')
end

puts "Loading #{town_files.size} town data files..."

# Build lookup: town:shop:item_name -> price
item_price_lookup = {}

town_files.each do |town_file|
  begin
    town_data = JSON.parse(File.read(town_file))
    town_name = town_data['town']

    puts "  Processing #{town_name}..."

    (town_data['shops'] || []).each do |shop|
      shop_name = extract_shop_name_from_preamble(shop['preamble'])

      # Fallback to first room title if extraction failed
      if shop_name.nil? || shop_name == "unknown" || shop_name.empty?
        if shop['inv'] && shop['inv'].first && shop['inv'].first['room_title']
          shop_name = shop['inv'].first['room_title']
        end
      end

      (shop['inv'] || []).each do |room|
        (room['items'] || []).each do |item|
          # Extract price
          price = 0
          if item['details']
            if item['details']['cost']
              price = item['details']['cost'].to_i
            elsif item['details']['raw']
              item['details']['raw'].each do |line|
                if line =~ /will cost ([\d,]+) coins/
                  price = $1.gsub(',', '').to_i
                  break
                end
              end
            end
          end

          # Create lookup key without price
          safe_town = safe_string(town_name)
          safe_shop = safe_string(shop_name)
          safe_item = item['name'].to_s.downcase.strip

          lookup_key = "#{safe_town}:#{safe_shop}:#{safe_item}"
          item_price_lookup[lookup_key] = price
        end
      end
    end
  rescue => e
    puts "  ERROR processing #{town_file}: #{e.message}"
  end
end

puts "Built lookup table with #{item_price_lookup.size} items from current inventory"

# Also check removed_items.json for items no longer in stock
removed_items_file = data_dir + "removed_items.json"
if removed_items_file.exist?
  puts ""
  puts "Loading removed_items.json for sold items..."
  removed_data = JSON.parse(File.read(removed_items_file))

  removed_data.each do |town_name, items|
    next unless items.is_a?(Array)

    items.each do |item|
      # Extract price
      price = 0
      if item['details']
        if item['details']['cost']
          price = item['details']['cost'].to_i
        elsif item['details']['raw']
          item['details']['raw'].each do |line|
            if line =~ /will cost ([\d,]+) coins/
              price = $1.gsub(',', '').to_i
              break
            end
          end
        end
      end

      # Get shop name from last_seen_shop or extract from preamble
      shop_name = item['last_seen_shop'] || 'unknown'

      # Create lookup key
      safe_town = safe_string(town_name)
      safe_shop = safe_string(shop_name)
      safe_item = item['name'].to_s.downcase.strip

      lookup_key = "#{safe_town}:#{safe_shop}:#{safe_item}"

      # Only add if we don't already have this item (current inventory takes precedence)
      item_price_lookup[lookup_key] ||= price
    end
  end

  puts "Lookup table now has #{item_price_lookup.size} items (including removed items)"
end

# Fix the entries
updated_items = {}
fixed_count = 0
not_found_count = 0
kept_count = 0

added_items.each do |signature, timestamp|
  # If it doesn't end with :0, keep it as-is
  if !signature.include?(':') || !signature.end_with?(':0')
    updated_items[signature] = timestamp
    kept_count += 1
    next
  end

  # Parse the signature
  parsed = parse_signature(signature)
  unless parsed
    puts "  WARNING: Could not parse signature: #{signature}"
    updated_items[signature] = timestamp
    kept_count += 1
    next
  end

  # Look up actual price
  lookup_key = "#{parsed[:town]}:#{parsed[:shop]}:#{parsed[:item_name]}"
  actual_price = item_price_lookup[lookup_key]

  if actual_price && actual_price > 0
    # Create new signature with correct price
    new_signature = "#{lookup_key}:#{actual_price}"
    updated_items[new_signature] = timestamp
    fixed_count += 1

    if fixed_count <= 5
      puts "  Fixed: #{signature}"
      puts "      -> #{new_signature}"
    end
  else
    # Item not found or still has 0 price - keep original
    updated_items[signature] = timestamp
    not_found_count += 1

    if not_found_count <= 3
      puts "  WARNING: Could not find price for: #{parsed[:item_name]}"
    end
  end
end

puts ""
puts "Results:"
puts "  Fixed with correct price: #{fixed_count}"
puts "  Not found (kept as :0): #{not_found_count}"
puts "  Kept unchanged: #{kept_count}"
puts "  Total entries: #{updated_items.size}"

# Backup original file
backup_file = data_dir + "added_items.json.backup"
puts ""
puts "Creating backup at #{backup_file}..."
File.write(backup_file, File.read(added_items_file))

# Write updated file
puts "Writing updated added_items.json..."
File.write(added_items_file, JSON.pretty_generate(updated_items))

puts ""
puts "Done! Original file backed up to #{backup_file}"
