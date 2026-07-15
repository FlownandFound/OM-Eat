-- Cost becomes free text so entries like "11.50 for 6" are valid.
-- Currency stays a separate picked code.
-- numeric(10,2)::text always yields two decimals; tidy "4.00" -> "4" and "4.50" -> "4.50" as-is.

alter table finds
  alter column cost_amount type text using regexp_replace(cost_amount::text, '\.00$', '');
