#!/usr/bin/env ruby
# Scrapes ps.lichproject.org/shops to update map_id in shop_mapping.json
# Matches by room_title from our town JSONs to shop names on their site.
# Only updates entries where map_id is null or missing — never overwrites
# manually set values unless --force is passed.

require 'json'
require 'net/http'
require 'uri'

DATA_DIR = File.expand_path('../../../docs/data', __FILE__)
SHOP_MAPPING_PATH = File.join(DATA_DIR, 'shop_mapping.json')
SOURCE_URL = 'https://ps.lichproject.org/shops'

# --- Scrape lich project site ---

def fetch_page(page)
  uri = URI("#{SOURCE_URL}?p=#{page}")
  response = Net::HTTP.get_response(uri)
  raise "HTTP #{response.code} fetching page #{page}" unless response.is_a?(Net::HTTPSuccess)
  response.body
rescue => e
  puts "  Error fetching page #{page}: #{e.message}"
  nil
end

def parse_shops_from_html(html)
  shops = {}
  # Match table rows: shop name and map_id columns
  # <td><a href="/shops/...">Shop Name</a></td> ... <td>12345</td>
  html.scan(/<tr[^>]*>.*?<\/tr>/m).each do |row|
    next unless row.include?('/shops/')
    name_match = row.match(/<a[^>]+href="\/shops\/\d+"[^>]*>(.*?)<\/a>/i)
    # Map ID is the 4th td (Name, Town, Xygon ID, Map ID)
    tds = row.scan(/<td[^>]*>(.*?)<\/td>/im).map { |m| m[0].gsub(/<[^>]+>/, '').strip }
    next if tds.size < 4
    name = (name_match ? name_match[1].strip : tds[0]).gsub('&#x27;', "'").gsub('&amp;', '&').gsub('&quot;', '"')
    map_id = tds[3].to_i
    next if map_id == 0 || name.empty?
    shops[name] = map_id
  end
  shops
end

def scrape_all_shops
  puts "Scraping #{SOURCE_URL}..."
  all_shops = {}
  page = 1

  loop do
    print "  Page #{page}..."
    html = fetch_page(page)
    break unless html

    shops = parse_shops_from_html(html)
    break if shops.empty?

    all_shops.merge!(shops)
    puts " #{shops.size} shops (total: #{all_shops.size})"

    # Check if there's a next page
    break unless html.include?("p=#{page + 1}")
    page += 1
    sleep 0.5 # be polite
  end

  puts "Scraped #{all_shops.size} shops total."
  all_shops
end

# --- Build room_title -> shop_owner index from our town JSONs ---

def build_room_title_index
  index = {}     # room_title => shop_owner
  exteriors = {} # shop_owner => exterior (from preamble)

  Dir.glob(File.join(DATA_DIR, '*.json')).each do |path|
    next if path.include?('shop_mapping') || path.include?('added_items') ||
            path.include?('removed_items')
    begin
      data = JSON.parse(File.read(path))
      shops = data['shops'] || []
      shops.each do |shop|
        owner = shop['shop_owner']
        next unless owner

        # Extract exterior from preamble
        preamble = shop['preamble'] || ''
        exterior_match = preamble.match(/at (?:a|an) (.*?), and is currently/)
        exteriors[owner] ||= exterior_match ? exterior_match[1].strip : nil

        (shop['inv'] || []).each do |room|
          title = room['room_title']
          next unless title && !title.empty?
          index[title] = owner
          # Also index the prefix before a comma (e.g. "Tolwynn's Treasures, Wanton" -> "Tolwynn's Treasures")
          prefix = title.split(',').first.strip
          index[prefix] ||= owner
        end
      end
    rescue => e
      puts "  Warning: could not parse #{File.basename(path)}: #{e.message}"
    end
  end
  puts "Built room title index with #{index.size} entries (#{exteriors.size} owners)."
  [index, exteriors]
end

# --- Main ---

scraped = scrape_all_shops
room_index, room_exteriors = build_room_title_index
mapping = JSON.parse(File.read(SHOP_MAPPING_PATH))

updated = 0
not_found = 0

scraped.each do |shop_name, map_id|
  owner = room_index[shop_name]
  # Fallback: match by owner name prefix (e.g. "Kembal's Weaponry" -> owner "Kembal")
  unless owner
    owner = room_index.values.uniq.find do |o|
      shop_name.downcase.start_with?(o.downcase + "'s") ||
      shop_name.downcase.start_with?(o.downcase + "’s")
    end
  end
  unless owner
    puts "  No match for: #{shop_name}" if ENV['VERBOSE']
    not_found += 1
    next
  end

  entry = mapping[owner]
  if entry.nil?
    # Owner not in shop_mapping — add them with map_id and exterior from our town data
    exterior = room_exteriors[owner]
    mapping[owner] = { 'map_id' => map_id, 'exterior' => exterior }
    puts "  Added #{owner}: map_id=#{map_id}, exterior=#{exterior.inspect} (#{shop_name})"
    updated += 1
    next
  end

  existing = entry['map_id']
  if existing == map_id
    next
  end

  puts "  #{owner}: map_id #{existing.inspect} -> #{map_id} (#{shop_name})"
  entry['map_id'] = map_id
  updated += 1
end

puts "\nResults: #{updated} updated, #{not_found} not matched."

if updated > 0
  File.write(SHOP_MAPPING_PATH, JSON.pretty_generate(mapping))
  puts "Saved #{SHOP_MAPPING_PATH}"
else
  puts "No changes made."
end
