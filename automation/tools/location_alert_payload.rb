#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Builds the Discord webhook payload for shop location change alerts.
# Input: path to the per-run alert file written by processor.rb
# (automation/logs/location_alert.json). Prints the JSON payload to stdout.

require "json"

changes = JSON.parse(File.read(ARGV[0]))
lines = changes.first(15).map do |c|
  owners = ->(shops) { (shops || []).map { |s| s["owner"] }.compact }
  before = owners.call(c["before"])
  after = owners.call(c["after"])
  detail = case c["change"]
           when "added" then after.join(", ")
           when "removed" then "was: " + before.join(", ")
           else
             delta = (after - before).map { |o| "+" + o } + (before - after).map { |o| "-" + o }
             delta.empty? ? "details changed (room name/exterior)" : delta.join(" ")
           end
  uid_label = c["uid"] == "unknown" ? "unknown room" : "u#{c['uid']}"
  "- #{c['change']} #{c['town']} #{uid_label}: #{detail}"
end
lines << "...and #{changes.size - 15} more" if changes.size > 15
content = "A player shop location change was detected!\n" \
          "#{lines.join("\n")}\n" \
          "Full log: https://shops.elanthia.online/data/location_changes.json"
print JSON.generate({ content: content[0, 1990] })
