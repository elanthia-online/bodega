#!/usr/bin/env ruby
# Fix shop_mapping.json to use owner names instead of full shop names

require 'json'

input_file = File.join(__dir__, '../../docs/data/shop_mapping.json')
output_file = input_file

# Read the current mapping
data = JSON.parse(File.read(input_file))

# Transform keys from "Owner's Shop Type" to just "Owner"
new_data = {}

data.each do |shop_name, shop_info|
  # Extract owner name from full shop name
  # Patterns:
  #   "Painz's Magic Shoppe" -> "Painz"
  #   "Unit's Magic Shoppe" -> "Unit"
  #   "Dark Tower Imports" -> "Dark Tower Imports" (no owner pattern, keep as-is)
  #   "The Best Defence" -> "The Best Defence" (business name, keep as-is)

  owner_name = if shop_name.match(/^(.*?)'s?\s+(Magic Shoppe|Weaponry|Armory|Outfitting|General Store|Combat Gear|Locksmith Shop|Shop|Boutique)$/i)
    # Has owner's name + shop type pattern
    $1
  elsif shop_name.match(/^(.*?)'s\s+(.*)$/i)
    # Has possessive but different pattern (e.g., "Stinkey's Locksmith Shop")
    $1
  else
    # Business name without owner pattern, keep as-is
    shop_name
  end

  new_data[owner_name] = shop_info

  if owner_name != shop_name
    puts "Transformed: #{shop_name} -> #{owner_name}"
  end
end

# Write the transformed data
File.write(output_file, JSON.pretty_generate(new_data))
puts "\nShop mapping updated successfully!"
puts "Total shops: #{new_data.size}"
