-- Merge terminal_area into place. Feedback: crew often can't remember the
-- vendor name, so the two fields become one: "Name of vendor / area of terminal".
-- Existing terminal_area values are appended to place before the column is dropped.

update finds
set place = case
  when place is null or place = '' then terminal_area
  else place || ', ' || terminal_area
end
where terminal_area is not null and terminal_area <> '';

alter table finds drop column terminal_area;
