#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Builds the Discord webhook payload for shop location change alerts.
# Input: path to the per-run alert file written by processor.rb
# (automation/logs/location_alert.json). Prints the JSON payload to stdout.

require "json"

changes = JSON.parse(File.read(ARGV[0]))

owners = ->(shops) { (shops || []).map { |s| s["owner"] }.compact }

# A "location" event moves shops between exterior rooms (added/removed
# rooms, or the owner roster at a room changing). A "details" event keeps
# the same shops in place but changes room name/exterior text (e.g., an
# owner customizing their storefront).
described = changes.map do |c|
  before = owners.call(c["before"])
  after = owners.call(c["after"])
  delta = (after - before).map { |o| "+" + o } + (before - after).map { |o| "-" + o }
  location_event = c["change"] != "modified" || !delta.empty?
  detail = case c["change"]
           when "added" then after.join(", ")
           when "removed" then "was: " + before.join(", ")
           else delta.empty? ? "details changed (room name/exterior)" : delta.join(" ")
           end
  uid_label = c["uid"] == "unknown" ? "unknown room" : "u#{c['uid']}"
  { line: "- #{c['change']} #{c['town']} #{uid_label}: #{detail}", location: location_event }
end

title =
  if described.all? { |d| d[:location] }
    "A player shop location change was detected!"
  elsif described.none? { |d| d[:location] }
    "A player shop exterior/room description change was detected!"
  else
    "Player shop location and description changes were detected!"
  end

lines = described.first(15).map { |d| d[:line] }
lines << "...and #{described.size - 15} more" if described.size > 15
content = "#{title}\n" \
          "#{lines.join("\n")}\n" \
          "Full log: https://shops.elanthia.online/data/location_changes.json"
print JSON.generate({ content: content[0, 1990] })
