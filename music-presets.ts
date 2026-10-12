/** مكتبة الأغاني الجاهزة للّمحات — بلا حقوق، تُنشأ مرة واحدة وتُشارك للجميع. */
export type MusicPreset = { key: string; title: string; emoji: string; prompt: string };

export const MUSIC_PRESETS: MusicPreset[] = [
  { key: "arabic-oud", title: "عود شرقي", emoji: "🪕", prompt: "Warm traditional Arabic oud solo, gentle maqam melody, soft percussion, instrumental, loopable" },
  { key: "arabic-modern", title: "طرب عصري", emoji: "🎶", prompt: "Modern Arabic pop instrumental with qanun, strings and light beat, joyful, instrumental" },
  { key: "khaleeji", title: "إيقاع خليجي", emoji: "🥁", prompt: "Khaleeji percussion groove with darbuka and clapping, energetic instrumental" },
  { key: "spiritual", title: "روحاني هادئ", emoji: "🕌", prompt: "Calm spiritual ambient with ney flute and soft pads, peaceful, instrumental" },
  { key: "happy", title: "فرح", emoji: "😄", prompt: "Upbeat happy pop instrumental, bright piano and claps, feel-good" },
  { key: "romantic", title: "رومانسي", emoji: "💗", prompt: "Soft romantic instrumental with violin and piano, warm and emotional" },
  { key: "epic", title: "حماسي", emoji: "🔥", prompt: "Epic cinematic instrumental, powerful drums and strings, motivational" },
  { key: "lofi", title: "لوفاي هادئ", emoji: "🎧", prompt: "Chill lofi hip hop beat, soft piano, vinyl warmth, relaxing instrumental" },
  { key: "travel", title: "سفر ومناظر", emoji: "🌄", prompt: "Uplifting cinematic travel instrumental, acoustic guitar and light percussion" },
  { key: "night", title: "ليلي", emoji: "🌙", prompt: "Dreamy night ambient instrumental, slow synth pads, calm and spacious" },
  { key: "kids", title: "مرح للأطفال", emoji: "🧸", prompt: "Playful cheerful kids instrumental, marimba and ukulele, light and fun" },
  { key: "sport", title: "رياضي", emoji: "🏃", prompt: "Energetic workout electronic instrumental, driving beat, motivating" },
];
