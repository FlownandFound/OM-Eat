-- JER added to the BAEF network from LGW.

insert into destinations (iata, city, country, slug) values
  ('JER', 'Jersey', 'Jersey', 'jersey')
on conflict (iata) do nothing;
