-- find_images was anon-readable regardless of the parent Find's status, so
-- photo records of archived Finds stayed listable through the API. Scope the
-- policy to published Finds, matching anon_read_published_finds.

drop policy anon_read_find_images on find_images;

create policy anon_read_find_images on find_images
  for select to anon using (
    exists (
      select 1 from finds
      where finds.id = find_images.find_id
        and finds.status = 'published'
    )
  );
