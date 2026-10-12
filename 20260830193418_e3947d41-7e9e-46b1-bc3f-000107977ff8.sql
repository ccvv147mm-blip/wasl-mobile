INSERT INTO public.music_tracks (key, title, prompt, url) VALUES
('arabic-oud','عود شرقي','library preset','library/arabic-oud.mp3'),
('arabic-modern','طرب عصري','library preset','library/arabic-modern.mp3'),
('khaleeji','إيقاع خليجي','library preset','library/khaleeji.mp3'),
('spiritual','روحاني هادئ','library preset','library/spiritual.mp3'),
('happy','فرح','library preset','library/happy.mp3'),
('romantic','رومانسي','library preset','library/romantic.mp3'),
('epic','حماسي','library preset','library/epic.mp3'),
('lofi','لوفاي هادئ','library preset','library/lofi.mp3'),
('travel','سفر ومناظر','library preset','library/travel.mp3'),
('night','ليلي','library preset','library/night.mp3'),
('kids','مرح للأطفال','library preset','library/kids.mp3'),
('sport','رياضي','library preset','library/sport.mp3')
ON CONFLICT (key) DO UPDATE SET title = excluded.title, url = excluded.url;