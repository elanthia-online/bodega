# One-off maintenance scripts

Historical, single-use data-migration scripts. These are **not** part of the
regular scan/process pipeline and should not be run routinely — they rewrite
committed data files in place. Kept for reference and in case a similar
migration is ever needed.

- `migrate-signatures.rb` — collapsed price-bearing item signatures
  (`town:shop:item:price`) in `added_items.json` to the price-free format
  (`town:shop:item`) after price was removed from the item identity signature.
  Run once; collapsed 8,444 duplicate price-variants.
- `fix-added-items-prices.rb` — earlier band-aid that reconciled price drift in
  `added_items.json`. Superseded by removing price from the signature entirely.
