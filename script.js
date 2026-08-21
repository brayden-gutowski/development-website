import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

const DEFAULT_DOCUMENT_TITLE = document.title;
const ENGLISH_WORDMARK = "BRAYDEN GUTOWSKI";
const JAPANESE_WORDMARK = "ブライデン・グトウスキ";
const WORDMARK_GLITCH_CHARACTERS = ["ア", "ヲ", "7", "#", "?", "▓"];

const CONFIG = {
  globeRadius: 1.72,
  markerAltitude: 0.028,
  maxGlobeScale: 0.82,
  cameraRestZ: 6.65,
  cameraFocusZ: 4.55,
  initialGlobeScale: 0.0014,
  scrollProgressRate: 0.00085,
  pinchProgressRate: 0.0045,
  maxPixelRatio: 1.75,
  dragSpeed: 0.0046,
  focusDuration: 1100,
  solarRefreshInterval: 60_000,
  cloudRotationPeriodMs: 24 * 60 * 1000,
  travelStarCount: 12,
  travelStarEndProgress: 0.7,
};

const LOCATIONS = {
  gainesville: {
    id: "gainesville",
    kicker: "Gainesville, Florida",
    heading: "Education",
    subheading: "University of Florida",
    detail: "Major in Computer Science",
    timeZone: "America/New_York",
    lat: 29.6516,
    lon: -82.3248,
    description: "I'm currently a player and the market coordinator for UF Valorant Esports.  I'm also a part of the DevLUp game development club at UF.",
    actions: [
      { label: "Game Development", drawerId: "game-development" },
      { label: "Coding projects", drawerId: "coding-projects" },
    ],
  },
  nashville: {
    id: "nashville",
    kicker: "Nashville, Tennessee",
    heading: "Music",
    subheading: "My favorite albums of all time",
    detail: "Music >= 9/10",
    timeZone: "America/Chicago",
    lat: 36.1627,
    lon: -86.7816,
    description: "Music has been an extremely influential part of my life and reviewing albums I've listened to has started to be a common pastime.  Using music sites like Album of the Year never sat right with me, having my own opinions buried under thousands of others who disagree with me, so I decided to put a music review area within my world.  Within my reviews I have listed every single album I have ever given over a 9/10.  These albums all either changed my life, my mind, or my inspirations in ways no other art form ever has, or likely ever will.",
    actions: [
      { label: "Music Reviews", drawerId: "music-reviews" },
    ],
  },
    tokyo: {
    id: "tokyo",
    kicker: "Tokyo, Japan",
    heading: "Languages",
    subheading: "Japanese at an N5 level; Proficient in English",
    detail: "Minor in Japanese Literature",
    timeZone: "Asia/Tokyo",
    lat: 35.6762,
    lon: 139.6503,
    description: "I have been learning Japanese for roughly a year, and have taken 2 courses for Japanese, placing me at around an N5 level.  I'm currently taking a third course, meaning I'm studying toward an N4 level.",
    actions: [
      { label: "Japanese Blog", drawerId: "japanese-blog" },
    ],
  },
};

const DRAWERS = {
  "game-development": {
    kicker: "Florida / Game Development",
    title: "Game Development",
    entries: [
      {
        title: "Arcade Adventures",
        meta: "Roblox Studio; Lua",
        description: "Arcade Adventures was my first, and currently my only, game I have released.  The game was produced within Roblox Studio using Lua, and broadened my views of game development in ways that someone who hasn't developed a game might not understand.  This project taught me how to use Blender extensively, and I plan on releasing the full game sometime in 2026.",
        image: "assets/ArcadeAdventuresWeb.webp",
        imageAlt: "Arcade Adventures game thumbnail showing players at arcade cabinets",
        href: "https://www.roblox.com/games/96313690258281/Arcade-Adventures",
        linkLabel: "Open on Roblox",
      },
    ],
  },
  "coding-projects": {
    kicker: "Florida / Coding Projects",
    title: "Coding Projects",
    entries: [
      {
        title: "Towski.dev",
        meta: "Javascript; HTML",
        description: "This website is a museum of my life I plan to update monthly or yearly for a long time. I hope that one day I've travelled the world and this globe is filled with different areas to look at.  In the meantime I have information on my Japanese and coding journey.\n\nThank you for looking at my world.",
        attributions: [
          {
            prefix: "Earth, cloud, and star textures by ",
            sourceLabel: "Solar System Scope",
            sourceHref: "https://edu.solarsystemscope.com/textures/",
            middle: ", for web use under ",
            licenseLabel: "CC BY 4.0",
            licenseHref: "https://creativecommons.org/licenses/by/4.0/",
            suffix: "; resized and converted for this site.",
          },
          {
            prefix: "Night lights imagery by ",
            sourceLabel: "NASA Earth Observatory",
            sourceHref: "https://visibleearth.nasa.gov/images/144898/earth-at-night-black-marble-2016-color-maps",
            suffix: ", using Suomi NPP VIIRS data (2016).",
          },
        ],
      },
      {
        title: "AREDL Discord Bot",
        meta: "REST API; Java",
        description: "This discord bot was my biggest dive into using APIs to automate a previously manual task.  This bot searched through the All Rated Extreme Demon List API in order to rank individual members within a discord server.  I implemented features like sorting via hardest level, total points, or extreme demon count for quality of life for users using a cached hash map of the leaderboard.",
      },
    ],
  },
  "japanese-blog": {
    kicker: "Japan / Japanese Blog",
    title: "日本語ブログ",
    description: "",
    supportsBlog: true,
  },
  "music-reviews": {
    kicker: "Nashville / Music Reviews",
    title: "Music Reviews",
    description: "",
    supportsMusicReviews: true,
  },
};

const JAPANESE_BLOG_CATEGORIES = [
  {
    id: "intermediate-japanese",
    name: "中級日本語",
    entries: [
      {
        id: "blog-entry-8-21-2026",
        title: "初めまして　　　2026年8月21日",
        body: [
          "こんにちはみなさん！私の名前はブライデンです。二年生です。せんこうはコンピュータサイエンスです。でも、私のふくせんこうは日本語文学です。しゅっしんはフロリダのメルボルンです。メルボルンにビーチがあります。とてもきれいです。私はビデオゲームをするのがとくいです。でも、今とてもいそがしいです。ファッションが好きです。たのしいですから。",
          "日本のゲームの中でいちばん好きなのはにゃんこだいせんそうです。ゲームは大きくてむずかしいです。それにねこはかわいいですね。今年、私はレジェンドストーリーをクリアしましたので、ぶんぶんネコライダーがあります。かっこいいですね。",
          "アニメの中でいちばん好きなのはジョジョのキミノウナボウケンです。パート４すごくおもしろい。私はテレビを見るのが好きです。それに、ロッククライミングをするのがすきです。でも、へたです。",
          "じゃあまた。",
        ],
        glossary: [
          ["ふくせんこう", "Academic minor"],
          ["にゃんこだいせんそう", "Battle Cats"],
          ["クリアする", "To complete (a game)"],
          ["レジェンドストーリー", "Stories of Legend"],
        ],
        media: [
          {
            src: "assets/blog-2026-08-21-left.webp",
            label: "A person sitting on a colorful patterned staircase",
            side: "left",
            caption: "このしゃしんですわていります",
            captionPosition: "below",
          },
          {
            src: "assets/blog-2026-08-21-climbing.jpg",
            label: "A person rock climbing on an indoor climbing wall",
            side: "right",
            caption: "このしゃしんでロッククライミングをしていります（ククライミングをするのがへたです。。。）",
            captionPosition: "above",
          },
          {
            src: "assets/blog-2026-08-21-mecha-bunbun.png",
            label: "Mecha Bun Bun Cat Rider character illustration",
            side: "left",
            aspectRatio: "995 / 1180",
            caption: "ぶんぶんネコライダーはとてもかっこいいです。",
            captionPosition: "below",
          },
          {
            src: "assets/blog-2026-08-21-jojos.jpg",
            label: "JoJo's Bizarre Adventure: Diamond Is Unbreakable promotional artwork",
            side: "right",
            aspectRatio: "560 / 800",
            caption: "ジョジョのキミノウナボウケンパート４",
            captionPosition: "above",
          },
        ],
      },
    ],
  },
];

// Add future album reviews here in descending rating order.
const MUSIC_REVIEW_CATEGORIES = [
  {
    id: "favorite-albums",
    entries: [
      {
        id: "the-college-dropout",
        title: "The College Dropout",
        artist: "Kanye West",
        rating: "10/10",
        description: "I have listened to new albums consistently for a few years now, and one of the first hip-hop albums I ever listened to front to back was The College Dropout.  I didn’t realize it at the time, but that album would be my favorite album of all time and no album following that one would reach a higher peak.  This album is genuinely incredible.  The skits are funny; the production is unique, catchy, and incredible; even the lyrics have a fun vibe you can’t find anywhere else.  This is, for many people, Kanye West’s greatest album.  For me, it is simply the greatest album.",
        image: "assets/college-dropout.jpg",
        imageAlt: "The College Dropout album cover by Kanye West",
      },
      {
        id: "they-left-me-with-the-sword",
        title: "They Left Me With The Sword",
        artist: "Paris Texas",
        rating: "10/10",
        description: "During the beginning of this year I felt my biggest and longest creativity block.  I spent months not being able to think about what to create when I typically enjoy being the first person I know to make a new project or idea come to life.  This isn’t an exaggeration when I say that upon the first listen of this EP my creativity block broke.  This EP is so beautifully put together and far blows away anything Paris Texas previously put out.  8 tracks with 6 total songs, and every single one is incredible.  Tantrum might be one of my favorite tracks of all time, the production stands out and the lyrics are fun too.  The last minute of the song especially shines to me with the electric guitar making the part almost feel over-produced while having so few elements.  El Camino is one of the best outro tracks I’ve heard since Paris Texas’ ‘...We Fall’ off of Mid Air.  If you happen to be reading this, I hope you decide to listen to this album, it seriously changed my life.",
        image: "assets/TheyLeftMeWithTheSword.jpg",
        imageAlt: "They Left Me With The Sword album cover by Paris Texas",
      },
      {
        id: "imaginal-disk",
        title: "Imaginal Disk",
        artist: "Magdalena Bay",
        rating: "10/10",
        description: "This album is the most unique album that stands on this list.  I listened to this for the first time closely after its release and didn’t like the album.  I later decided to re-listen to the album and it was incredible.  The story hidden within the album feels convoluted and too mysterious to unfold, but that's the point.  The actual instruments and sounds give you the rest of the key to making the story feel strange and otherworldly.  If you haven’t listened to this album, I really highly recommend it, there's nothing else like it.",
        image: "assets/ImaginalDiskj.jpg",
        imageAlt: "Imaginal Disk album cover by Magdalena Bay",
      },
      {
        id: "the-forever-story",
        title: "The Forever Story",
        artist: "J.I.D",
        rating: "9.8/10",
        description: "No other album tells a story to me like The Forever Story by JID.  Song by song, the album is non-stop incredible.  It’s almost unfortunate that the song that seemed to go viral was Surround Sound, which I personally believe is in the bottom 3 of the album.  Songs like Crack Sandwich show JID as the best lyricist of all time, and the song Kody Blue 31 has been my favorite song of all time since I first heard it.  The craziest part about this record is it isn’t like I just named everyone’s favorite songs.  Raydar, Dance Now, Stars, Lauder Too, and 2007 are all incredible songs that tell their own stories with incredible production, properly implemented flow switches, and lyricism capable of placing JID in the top 1 conversation.",
        image: "assets/TheForeverStory.jpg",
        imageAlt: "The Forever Story album cover by J.I.D",
      },
      {
        id: "the-miseducation-of-lauryn-hill",
        title: "The Miseducation of Lauryn Hill",
        artist: "Lauryn Hill",
        rating: "9.8/10",
        description: "An album released in the 20th century has no place having better production than modern hip-hop albums.  I personally believe this is the best example of hip-hop, r&b, and soul fusion that has ever touched music.  This album is an inspiration to millions of people and deserves every ounce of recognition it gets.  This review doesn’t even need to do it justice because you’ve already heard it.",
        image: "assets/TheMiseducationOfLaurenHill.jpg",
        imageAlt: "The Miseducation of Lauryn Hill album cover by Lauryn Hill",
      },
      {
        id: "to-pimp-a-butterfly",
        title: "To Pimp a Butterfly",
        artist: "Kendrick Lamar",
        rating: "9.6/10",
        description: "Kendrick Lamar has shown time and time again why he is one of the best lyricists of all time.  This album was his 2nd time showcasing that off to the world in his full capacity, and his first time doing it nearly flawlessly.  I find this album to be a marvel that has an incredible tracklist with incredible ideas for songs.  Mortal Man alone is enough to show a new listener how great he is with new song concepts, and songs across the tracklist fight against systematic oppression in ways few other artists manage to do.",
        image: "assets/ToPimpAButterfly.jpg",
        imageAlt: "To Pimp a Butterfly album cover by Kendrick Lamar",
      },
      {
        id: "hurry-up-tomorrow",
        title: "Hurry Up Tomorrow",
        artist: "The Weeknd",
        rating: "9.5/10",
        description: "Hurry Up Tomorrow was The Weeknd’s retirement album, and I also believe it is the best album in his career.  The concept of having everything and feeling yourself lose your most valued item, your memories, is such a difficult thing to discuss, and The Weeknd does it beautifully.  The production on this album is something no other artist could achieve, and the vocals on this album are almost good enough to make someone cry.  Songs like Wake Me Up set the tone for the album, and then The Weeknd immediately jumps back into being a hitmaker with Cry For Me.  If you’ve never heard this album, take a drive late at night on 95 and listen to it, it really is a life-changing experience.",
        image: "assets/HurryUpTomorrow.jpg",
        imageAlt: "Hurry Up Tomorrow album cover by The Weeknd",
      },
      {
        id: "illmatic",
        title: "Illmatic",
        artist: "Nas",
        rating: "9.5/10",
        description: "Almost everyone would put Illmatic as their best hip-hop debut album of all time, and for good reason.  The lyricism and topics covered in each song is simply incredible and has aged to be one of the greatest albums of all time.  I find it impressive how Nas started out so strong, fell so far, and then came back up with his recent releases of Kings Disease.  Nas’ lyricism is a marvel, and this album is the best example of it by far.",
        image: "assets/Illmatic.jpg",
        imageAlt: "Illmatic album cover by Nas",
      },
      {
        id: "blonde",
        title: "Blonde",
        artist: "Frank Ocean",
        rating: "9.4/10",
        description: "My favorite retirement album of all time (hopefully not…).  This album is beautiful from start to finish, with the vocals from Frank Ocean becoming an added instrument rather than a voice over other instruments.  Channel Orange was already phenomenal and this album just shows the growth that occurred over the 4 years he waited between the albums.  Nights has the most beautiful beat switch in history, and an incredible guitar solo as well.  Be careful when you listen to this project though, the topics end up being a bit rough if you’re fresh out of a relationship.",
        image: "assets/Blonde.jpg",
        imageAlt: "Blonde album cover by Frank Ocean",
      },
      {
        id: "because-the-internet",
        title: "Because The Internet",
        artist: "Childish Gambino",
        rating: "9.4/10",
        description: "Because The Internet is an album that is seemingly polarizing but I will always stand by the fact that I love it.  This album’s lyrics have not aged well, but that almost makes it better.  This album has become a time capsule for the time it was released, and the production on every song is extremely fun.  I find a lot of this album to be more unique than many modern hip-hop projects manage to be, and I appreciate the risks that Donald Glover took when making this project.  Every time I listen to this album, I catch a new lyric that makes me chuckle.",
        image: "assets/BecauseTheInternet.jpg",
        imageAlt: "Because The Internet album cover by Childish Gambino",
      },
      {
        id: "igor",
        title: "Igor",
        artist: "Tyler, The Creator",
        rating: "9.3/10",
        description: "Igor is probably my favorite conceptual album of all time.  The story behind it is unique and clear, but the songs don’t step too hard into telling the story so that they become rudimentary and boring.  Tyler has shown repeatedly that he knows no norms, and he proves it with his production once again on this album.  ‘ARE WE STILL FRIENDS?’ is my personal favorite song, and little details like the album ending nearly as it began just show the talent and thought put behind this album.",
        image: "assets/Igor.jpg",
        imageAlt: "Igor album cover by Tyler, The Creator",
      },
      {
        id: "let-god-sort-em-out",
        title: "Let God Sort Em Out",
        artist: "Clipse",
        rating: "9.2/10",
        description: "Only one song has ever made me cry: The Birds Don’t Sing.  This album has Pharell beats from start to finish so it was bound to be a masterpiece.  Probably my favorite 5 run track of all time is the first 5 songs of this album, and every other song is a banger too.  The Bird’s Don’t Sing is an emotional and heartbreaking song that discusses the death of both of Malice and Pusha’s parents, a topic that is such a nightmare for anyone listening that it instantly engages the listener and connects them to the artists.",
        image: "assets/LetGodSortEmOut.jpg",
        imageAlt: "Let God Sort Em Out album cover by Clipse",
      },
      {
        id: "they-left-me-with-the-gun",
        title: "They Left Me With The Gun",
        artist: "Paris Texas",
        rating: "9.1/10",
        description: "They Left Me With The Gun is the sequel to They Left Me With The Sword, and it retains almost all of its talent and uniqueness that made the first stand out.  This EP has incredibly strong songs and does the same swapping back and forth from heavy rock to peaceful love songs as the first.  Going from HALO to No Strings is an experience, and it’s incredibly well done.  Much like the first part to this EP, the lyrics stay funny enough to keep you engaged throughout the album, and the production remains incredible.",
        image: "assets/TheyLeftMeWithTheGun.jpg",
        imageAlt: "They Left Me With The Gun album cover by Paris Texas",
      },
      {
        id: "the-life-of-pablo",
        title: "The Life of Pablo",
        artist: "Kanye West",
        rating: "9.1/10",
        description: "The Life of Pablo is my second favorite Kanye West album to date, and that stands for a number of reasons.  The production is once again, incredible and unique.  Kanye West shows that he wants to push the limits of hip-hop with every coming album, and manages to make the best song of his career, Saint Pablo, be the finisher on the album.  Songs like Ultralight Beam see a beautiful production with Chance the Rapper in his prime, while songs like Fade would go on to begin the collaboration between Kanye West and Ty Dolla $ign.  This album shows Kanye West having fun with production, and as a result, it comes off as a fun album to listen to.  I highly recommend this project.",
        image: "assets/TheLifeOfPablo.jpg",
        imageAlt: "The Life of Pablo album cover by Kanye West",
      },
      {
        id: "endless",
        title: "Endless",
        artist: "Frank Ocean",
        rating: "9/10",
        description: "This album being his ‘trick’ to get out of his label is hilarious to me, because it’s a masterpiece.  I dropped hundreds of dollars years ago in order to get the vinyl of this, and I don’t regret it at all.  It has an unfinished feel that doesn’t actually hurt the project as the topics covered in the project feel more raw and vocalized due to it.  This album actually gave me a lot of inspiration for this website, as both the cover and tracks are quite inspirational.",
        image: "assets/Endless.jpg",
        imageAlt: "Endless album cover by Frank Ocean",
      },
      {
        id: "late-registration",
        title: "Late Registration",
        artist: "Kanye West",
        rating: "9/10",
        description: "The college trilogy is often thought to be the prime of Kanye West, and this album backs that claim.  Late Registration has production that you can only find with a Kanye album, and even songs that break the norm entirely, such as Addiction, sound so good it's confusing.  This album is a relic of the past, and the topics covered have aged better than the topics in any other album.  In particular, Hey Mama is enough to make me cry nowadays.",
        image: "assets/LateRegistration.jpg",
        imageAlt: "Late Registration album cover by Kanye West",
      },
      {
        id: "samurai",
        title: "Samurai",
        artist: "Lupe Fiasco",
        rating: "9/10",
        description: "Lupe Fiasco’s Samurai is his return to glory.  While I love many projects by Lupe Fiasco, none have even come close to this project besides The Cool, which was nearly 20 years ago.  This album shows Lupe rapping at his absolute strongest, backed by some insanely unique tracks that keep me coming back to listen again.  Unfortunately I feel like this album got skipped over when it was released, so I really recommend listening to it.",
        image: "assets/Samurai.jpg",
        imageAlt: "Samurai album cover by Lupe Fiasco",
      },
      {
        id: "chromakopia",
        title: "CHROMAKOPIA",
        artist: "Tyler, The Creator",
        rating: "9/10",
        description: "CHROMAKOPIA is an emotional ride that discusses Tyler’s ride through fame and a pregnancy scare.  This album broke every rule that Tyler set for himself, which is what made it so great.  Songs like Darling, I and Sticky manage to find their way into the album as a hit, while songs like I Killed You and Like Him manage to be the emotional rollercoaster that Tyler clearly planned them out to be.",
        image: "assets/CHROMAKOPIA.jpg",
        imageAlt: "CHROMAKOPIA album cover by Tyler, The Creator",
      },
    ],
  },
];

function readBlogRoute() {
  const match = window.location.hash.match(/^#blog\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  try {
    return {
      categoryId: decodeURIComponent(match[1]),
      entryId: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function findBlogEntry(categoryId, entryId) {
  const category = JAPANESE_BLOG_CATEGORIES.find((item) => item.id === categoryId);
  const entry = category?.entries?.find((item) => item.id === entryId);
  return category && entry ? { category, entry } : null;
}

function writeBlogRoute(categoryId, entryId, { replace = false } = {}) {
  const route = `#blog/${encodeURIComponent(categoryId)}/${encodeURIComponent(entryId)}`;
  const match = findBlogEntry(categoryId, entryId);
  window.history[replace ? "replaceState" : "pushState"](null, "", route);
  document.title = match ? `${match.entry.title} | ${DEFAULT_DOCUMENT_TITLE}` : DEFAULT_DOCUMENT_TITLE;
}

function clearBlogRoute({ replace = true } = {}) {
  if (!readBlogRoute()) return;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history[replace ? "replaceState" : "pushState"](null, "", cleanUrl);
  document.title = DEFAULT_DOCUMENT_TITLE;
}

const ui = {
  app: document.querySelector("#app"),
  stage: document.querySelector("#globe-stage"),
  canvas: document.querySelector("#globe-canvas"),
  fallback: document.querySelector("#canvas-fallback"),
  loading: document.querySelector("#loading-screen"),
  progress: document.querySelector("#load-progress"),
  loadStatus: document.querySelector("#load-status"),
  guide: document.querySelector("#interaction-guide"),
  panel: document.querySelector("#location-panel"),
  panelClose: document.querySelector("#close-panel"),
  kicker: document.querySelector("#location-kicker"),
  localTime: document.querySelector("#location-local-time"),
  localTimeValue: document.querySelector("#location-local-time-value"),
  heading: document.querySelector("#location-heading"),
  subheading: document.querySelector("#location-subheading"),
  detail: document.querySelector("#location-detail"),
  description: document.querySelector("#location-description"),
  actions: document.querySelector("#location-actions"),
  locationLinks: [...document.querySelectorAll("[data-location]")],
  wordmark: document.querySelector(".wordmark"),
  wordmarkTitle: document.querySelector("#wordmark-title"),
  wordmarkNames: [...document.querySelectorAll(".wordmark__name")],
  wordmarkAccentPrefix: document.querySelector(".wordmark__accent-prefix"),
  wordmarkAccentName: document.querySelector(".wordmark__accent-name"),
  wordmarkPath: document.querySelector("#wordmark-path"),
  wordmarkSuffixes: [...document.querySelectorAll(".wordmark__suffix")],
  drawer: document.querySelector("#content-drawer"),
  drawerClose: document.querySelector("#close-drawer"),
  drawerKicker: document.querySelector("#drawer-kicker"),
  drawerTitle: document.querySelector("#drawer-title"),
  drawerDescription: document.querySelector("#drawer-description"),
  drawerContent: document.querySelector("#drawer-content"),
};

const state = {
  selectedId: null,
  dragging: false,
  dragged: false,
  pointerId: null,
  activePointers: new Map(),
  pinchDistance: 0,
  pinching: false,
  initialZoomAligned: false,
  previousPointer: new THREE.Vector2(),
  pointerNdc: new THREE.Vector2(),
  currentQuaternion: new THREE.Quaternion(),
  targetQuaternion: new THREE.Quaternion(),
  focusStartQuaternion: new THREE.Quaternion(),
  focusStartZoomProgress: 0,
  focusStartGlobeScale: CONFIG.initialGlobeScale,
  focusStartCameraZ: CONFIG.cameraRestZ,
  focusStartedAt: 0,
  focusActive: false,
  drawerId: null,
  zoomProgress: 0,
  zoomCurrentProgress: 0,
  globeCurrentScale: CONFIG.initialGlobeScale,
  globeTargetScale: CONFIG.initialGlobeScale,
  cameraTargetZ: CONFIG.cameraRestZ,
  cameraCurrentZ: CONFIG.cameraRestZ,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

let renderer;
let scene;
let camera;
let earthGroup;
let skySphere;
let travelStarGroup;
let travelStars;
let earthStar;
let raycaster;
let sunlight;
let earthMaterial;
let cloudLayer;
let markerGlowTexture;
const sunDirectionLocal = new THREE.Vector3();
const sunDirectionWorld = new THREE.Vector3(0, 0, 1);
let nextSolarUpdateAt = 0;
let nextLocalTimeUpdateAt = 0;
let markerHitTargets = [];
let frameId;
let wordmarkTransitionToken = 0;

function setLoadProgress(percent, message) {
  ui.progress.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  ui.loadStatus.textContent = message;
}

function closeLoadingScreen() {
  setLoadProgress(100, "Ready");
  window.setTimeout(() => ui.loading.classList.add("is-complete"), 280);
}

function showFallback(message) {
  cancelAnimationFrame(frameId);
  ui.fallback.hidden = false;
  ui.fallback.querySelector("p").textContent = message;
  ui.loading.classList.add("is-complete");
}

function setWordmarkName(name) {
  ui.wordmarkNames.forEach((wordmarkName) => {
    wordmarkName.textContent = name;
  });
}

function setWordmarkAccent(name) {
  const isJapanese = name === JAPANESE_WORDMARK;
  ui.wordmarkAccentPrefix.textContent = isJapanese ? "ブライデン・グ" : "Brayden Gu";
  ui.wordmarkAccentName.textContent = isJapanese ? "トウスキ" : "towski";
}

function distributeWordmarkCharacters(characters, slotCount) {
  const slots = Array(slotCount).fill("");
  if (characters.length === 1) {
    slots[Math.floor(slotCount / 2)] = characters[0];
    return slots;
  }
  characters.forEach((character, index) => {
    const slotIndex = Math.round((index / (characters.length - 1)) * (slotCount - 1));
    slots[slotIndex] = character;
  });
  return slots;
}

function shuffledWordmarkSlots(slotCount) {
  const slots = Array.from({ length: slotCount }, (_value, index) => index);
  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
  }
  if (slots.every((slot, index) => slot === index) && slots.length > 1) {
    [slots[0], slots[1]] = [slots[1], slots[0]];
  }
  return slots;
}

function waitForWordmarkFrame(duration, token) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(token === wordmarkTransitionToken), duration);
  });
}

async function transitionWordmarkTo(targetName) {
  const currentName = ui.wordmarkNames[0]?.textContent || ENGLISH_WORDMARK;
  const isGlitching = ui.wordmark.classList.contains("is-glitching");
  const isJapaneseWordmark = ui.wordmark.classList.contains("is-japanese");
  const targetsJapaneseWordmark = targetName === JAPANESE_WORDMARK;
  if (!isGlitching && isJapaneseWordmark === targetsJapaneseWordmark) return;
  const token = ++wordmarkTransitionToken;

  if (state.reducedMotion) {
    setWordmarkName(targetName);
    setWordmarkAccent(targetName);
    ui.wordmark.classList.toggle("is-japanese", targetName === JAPANESE_WORDMARK);
    ui.wordmarkTitle.textContent = `${targetName}.dev`;
    return;
  }

  const sourceCharacters = [...currentName];
  const targetCharacters = [...targetName];
  const slotCount = Math.max(sourceCharacters.length, targetCharacters.length);
  const currentSlots = distributeWordmarkCharacters(sourceCharacters, slotCount);
  const targetSlots = distributeWordmarkCharacters(targetCharacters, slotCount);
  const transitionSlots = shuffledWordmarkSlots(slotCount)
    .filter((slotIndex) => currentSlots[slotIndex] !== targetSlots[slotIndex]);
  ui.wordmark.classList.add("is-glitching");

  for (let index = 0; index < transitionSlots.length; index += 1) {
    const slotIndex = transitionSlots[index];
    const glitchCharacter = WORDMARK_GLITCH_CHARACTERS[index % WORDMARK_GLITCH_CHARACTERS.length];
    currentSlots[slotIndex] = glitchCharacter;
    setWordmarkName(currentSlots.join(""));
    if (!await waitForWordmarkFrame(32, token)) return;
    currentSlots[slotIndex] = targetSlots[slotIndex];
    setWordmarkName(currentSlots.join(""));
    if (!await waitForWordmarkFrame(58, token)) return;
  }

  if (token !== wordmarkTransitionToken) return;
  setWordmarkName(targetName);
  setWordmarkAccent(targetName);
  ui.wordmark.classList.remove("is-glitching");
  ui.wordmark.classList.toggle("is-japanese", targetName === JAPANESE_WORDMARK);
  ui.wordmarkTitle.textContent = `${targetName}.dev`;
}

function chooseEarthTexture() {
  const isCompact = window.innerWidth <= 800 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  return isCompact ? "assets/earth-2048.webp" : "assets/earth-4096.webp";
}

function chooseStarTexture() {
  const isCompact = window.innerWidth <= 800 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  if (isCompact) return "assets/stars-2560.webp";
  if (navigator.deviceMemory && navigator.deviceMemory <= 6) return "assets/stars-4096.webp";
  return "assets/stars-8192.webp";
}

function chooseNightTexture() {
  return window.innerWidth <= 800
    ? "assets/earth-night-2048.webp"
    : "assets/earth-night-3600.jpg";
}

function chooseCloudTexture() {
  return window.innerWidth <= 800
    ? "assets/earth-clouds-2048.webp"
    : "assets/earth-clouds-4096.webp";
}

function getRestCameraZ() {
  if (!camera || camera.aspect >= 0.9) return CONFIG.cameraRestZ;
  const halfVerticalFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const mobileWidthFill = 0.86;
  return Math.max(
    CONFIG.cameraRestZ,
    CONFIG.globeRadius / (Math.tan(halfVerticalFov) * camera.aspect * mobileWidthFill),
  );
}

function getFocusCameraZ() {
  const restZ = getRestCameraZ();
  if (camera?.aspect < 0.9) return restZ * 0.66;
  const laptopFocusOffset = THREE.MathUtils.clamp((1 - getLayoutScale()) * 3.7, 0, 1.35);
  const ultrawideFocusOffset = THREE.MathUtils.clamp(
    (camera.aspect - (16 / 9)) * 1.05,
    0,
    0.75,
  );
  return CONFIG.cameraFocusZ + Math.max(laptopFocusOffset, ultrawideFocusOffset);
}

function globeScaleFromProgress(progress) {
  const eased = Math.pow(THREE.MathUtils.clamp(progress, 0, 1), 1.6);
  return THREE.MathUtils.lerp(CONFIG.initialGlobeScale, CONFIG.maxGlobeScale, eased);
}

function getLayoutScale() {
  return Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
}

function createStarSpriteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.18, "rgba(238, 246, 255, 0.92)");
  gradient.addColorStop(0.5, "rgba(195, 218, 238, 0.26)");
  gradient.addColorStop(1, "rgba(150, 188, 220, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTravelStars() {
  const positions = [];
  const paths = [];
  let seed = 4729;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let index = 0; index < CONFIG.travelStarCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const startZ = THREE.MathUtils.lerp(-10, 1.2, random());
    const distanceFromRestCamera = CONFIG.cameraRestZ - startZ;
    const angularRadius = THREE.MathUtils.lerp(0.09, 0.5, Math.sqrt(random()));
    const baseX = Math.cos(angle) * angularRadius * distanceFromRestCamera;
    const baseY = Math.sin(angle) * angularRadius * distanceFromRestCamera;
    const passAt = THREE.MathUtils.lerp(0.43, 0.68, random());
    positions.push(baseX, baseY, startZ);
    paths.push({ baseX, baseY, startZ, distanceFromRestCamera, passAt });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.userData.paths = paths;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSprite: { value: createStarSpriteTexture() },
      uColor: { value: new THREE.Color(0xe8f6ff) },
      uOpacity: { value: 0.92 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio) },
      uPointScale: { value: 72 },
    },
    vertexShader: `
      uniform float uPixelRatio;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float cssPointSize = clamp(uPointScale / max(1.0, -viewPosition.z), 2.35, 12.0);
        gl_PointSize = cssPointSize * uPixelRatio;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSprite;
      uniform vec3 uColor;
      uniform float uOpacity;

      void main() {
        vec4 sprite = texture2D(uSprite, gl_PointCoord);
        if (sprite.a < 0.01) discard;
        gl_FragColor = vec4(uColor, sprite.a * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "travel-stars";
  stars.frustumCulled = false;
  return stars;
}

function updateTravelStars(progress) {
  const positions = travelStars.geometry.attributes.position;
  const paths = travelStars.geometry.userData.paths;
  const endZ = camera.position.z + 0.8;

  travelStars.visible = progress < CONFIG.travelStarEndProgress;

  for (let index = 0; index < positions.count; index += 1) {
    const offset = index * 3;
    const path = paths[index];

    if (progress >= path.passAt) {
      positions.array[offset] = 0;
      positions.array[offset + 1] = 0;
      positions.array[offset + 2] = camera.position.z + 1;
      continue;
    }

    const pathProgress = THREE.MathUtils.clamp(progress / path.passAt, 0, 1);
    const rotatedStart = new THREE.Vector3(path.baseX, path.baseY, path.startZ)
      .applyQuaternion(skySphere.quaternion);
    positions.array[offset] = rotatedStart.x;
    positions.array[offset + 1] = rotatedStart.y;
    positions.array[offset + 2] = THREE.MathUtils.lerp(rotatedStart.z, endZ, pathProgress);
  }

  positions.needsUpdate = true;
  travelStars.material.uniforms.uPointScale.value = 66 + progress * 14;
  travelStars.material.uniforms.uOpacity.value = 0.92;
}

function createEarthStar() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.08], 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.05,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);
  point.name = "earth-as-star";
  return point;
}

function createMarkerGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.14, "rgba(255, 255, 255, 0.92)");
  gradient.addColorStop(0.34, "rgba(250, 252, 255, 0.42)");
  gradient.addColorStop(0.64, "rgba(250, 252, 255, 0.11)");
  gradient.addColorStop(1, "rgba(250, 252, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function latLonToVector3(lat, lon, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function getSubsolarPoint(date = new Date()) {
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 0);
  const currentDay = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.floor((currentDay - startOfYear) / 86_400_000);
  const daysInYear = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;
  const utcHours = date.getUTCHours()
    + date.getUTCMinutes() / 60
    + date.getUTCSeconds() / 3600;
  const fractionalYear = (2 * Math.PI / daysInYear)
    * (dayOfYear - 1 + (utcHours - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(fractionalYear)
    - 0.032077 * Math.sin(fractionalYear)
    - 0.014615 * Math.cos(2 * fractionalYear)
    - 0.040849 * Math.sin(2 * fractionalYear)
  );
  const declination = 0.006918
    - 0.399912 * Math.cos(fractionalYear)
    + 0.070257 * Math.sin(fractionalYear)
    - 0.006758 * Math.cos(2 * fractionalYear)
    + 0.000907 * Math.sin(2 * fractionalYear)
    - 0.002697 * Math.cos(3 * fractionalYear)
    + 0.00148 * Math.sin(3 * fractionalYear);
  const utcMinutes = utcHours * 60;
  const rawLongitude = (720 - utcMinutes - equationOfTime) / 4;
  const longitude = ((rawLongitude + 540) % 360) - 180;
  return {
    lat: THREE.MathUtils.radToDeg(declination),
    lon: longitude,
  };
}

function isLocationInDaylight(location, date) {
  const subsolarPoint = getSubsolarPoint(date);
  const locationLat = THREE.MathUtils.degToRad(location.lat);
  const subsolarLat = THREE.MathUtils.degToRad(subsolarPoint.lat);
  const longitudeDifference = THREE.MathUtils.degToRad(location.lon - subsolarPoint.lon);
  const sunFacing = Math.sin(locationLat) * Math.sin(subsolarLat)
    + Math.cos(locationLat) * Math.cos(subsolarLat) * Math.cos(longitudeDifference);
  return sunFacing > 0;
}

function updateLocationLocalTime(date = new Date()) {
  const location = LOCATIONS[state.selectedId];
  if (!location) return;
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    timeZone: location.timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const period = isLocationInDaylight(location, date) ? "day" : "night";
  ui.localTime.dataset.period = period;
  ui.localTimeValue.dateTime = date.toISOString();
  ui.localTimeValue.textContent = formattedTime;
  ui.localTime.setAttribute(
    "aria-label",
    `${formattedTime} local time in ${location.kicker}. It is currently ${period === "day" ? "daytime" : "nighttime"}.`,
  );
  nextLocalTimeUpdateAt = date.getTime() + 30_000;
}

function updateSolarLighting() {
  if (!earthGroup || !sunlight) return;
  const now = Date.now();
  if (now >= nextSolarUpdateAt) {
    const subsolarPoint = getSubsolarPoint(new Date(now));
    sunDirectionLocal.copy(latLonToVector3(subsolarPoint.lat, subsolarPoint.lon, 1)).normalize();
    nextSolarUpdateAt = now + CONFIG.solarRefreshInterval;
  }
  sunDirectionWorld.copy(sunDirectionLocal).applyQuaternion(earthGroup.quaternion).normalize();
  sunlight.position.copy(sunDirectionWorld).multiplyScalar(12);
  const shader = earthMaterial?.userData.shader;
  if (shader) shader.uniforms.uSunDirection.value.copy(sunDirectionWorld);
}

function orientationForLocation(location) {
  const localDirection = latLonToVector3(location.lat, location.lon, 1).normalize();
  return new THREE.Quaternion().setFromUnitVectors(
    localDirection,
    new THREE.Vector3(0, 0, 1),
  );
}

function alignFirstZoomToFlorida() {
  if (state.initialZoomAligned) return;
  const floridaOrientation = orientationForLocation(LOCATIONS.gainesville);
  state.currentQuaternion.copy(floridaOrientation);
  state.targetQuaternion.copy(floridaOrientation);
  state.focusActive = false;
  earthGroup?.quaternion.copy(floridaOrientation);
  state.initialZoomAligned = true;
}

function createMarker(location) {
  const marker = new THREE.Group();
  marker.name = `marker-${location.id}`;
  marker.userData = { locationId: location.id, phase: 0 };

  const position = latLonToVector3(
    location.lat,
    location.lon,
    CONFIG.globeRadius + CONFIG.markerAltitude,
  );
  marker.position.copy(position);
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());

  markerGlowTexture ??= createMarkerGlowTexture();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({
      map: markerGlowTexture,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.position.z = 0.004;
  glow.name = "signal-glow";
  marker.add(glow);

  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 32), dotMaterial);
  dot.position.z = 0.007;
  dot.name = "signal-dot";
  marker.add(dot);

  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitTarget.userData.locationId = location.id;
  marker.add(hitTarget);
  markerHitTargets.push(hitTarget);

  earthGroup.add(marker);
}

function setupScene(
  earthTexture,
  normalTexture,
  roughnessTexture,
  heightTexture,
  starsTexture,
  nightTexture,
  cloudTexture,
) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  const initialCameraZ = getRestCameraZ();
  camera.position.set(0, 0, initialCameraZ);
  state.cameraCurrentZ = initialCameraZ;
  state.cameraTargetZ = initialCameraZ;

  renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  raycaster = new THREE.Raycaster();
  travelStars = createTravelStars();
  travelStarGroup = new THREE.Group();
  travelStarGroup.name = "travel-star-system";
  travelStarGroup.add(travelStars);
  earthStar = createEarthStar();
  scene.add(travelStarGroup, earthStar);
  earthGroup = new THREE.Group();
  earthGroup.name = "earth-system";
  earthGroup.scale.setScalar(CONFIG.initialGlobeScale);
  scene.add(earthGroup);

  earthTexture.colorSpace = THREE.SRGBColorSpace;
  starsTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  starsTexture.wrapS = THREE.RepeatWrapping;
  starsTexture.wrapT = THREE.ClampToEdgeWrapping;
  starsTexture.repeat.set(1, 1);
  starsTexture.offset.set(0, 0);
  nightTexture.wrapS = THREE.RepeatWrapping;
  nightTexture.wrapT = THREE.ClampToEdgeWrapping;
  cloudTexture.wrapS = THREE.RepeatWrapping;
  cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
  earthTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  normalTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  roughnessTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  heightTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  starsTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  nightTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  cloudTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  skySphere = new THREE.Mesh(
    new THREE.SphereGeometry(42, 96, 64),
    new THREE.MeshBasicMaterial({
      map: starsTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  skySphere.name = "rotating-star-sphere";
  skySphere.renderOrder = -10;
  scene.add(skySphere);

  earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.72, 0.72),
      roughness: 0.96,
      roughnessMap: roughnessTexture,
      metalness: 0,
      displacementMap: heightTexture,
      displacementScale: 0.018,
      displacementBias: -0.002,
  });
  earthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uNightMap = { value: nightTexture };
    shader.uniforms.uSunDirection = { value: sunDirectionWorld.clone() };
    shader.uniforms.uWordmarkGlowStrength = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vEarthWorldNormal;",
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nvEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uNightMap;\nuniform vec3 uSunDirection;\nuniform float uWordmarkGlowStrength;\nvarying vec3 vEarthWorldNormal;",
      )
      .replace(
        "#include <opaque_fragment>",
        `
          vec3 earthWorldNormal = normalize(vEarthWorldNormal);
          vec3 surfaceLight = outgoingLight;
          float sunFacing = dot(earthWorldNormal, normalize(uSunDirection));
          float nightAmount = 1.0 - smoothstep(-0.18, 0.12, sunFacing);
          vec3 nightColor = texture2D(uNightMap, vMapUv).rgb * 1.12;
          outgoingLight = mix(surfaceLight, nightColor, nightAmount);

          float wordmarkUpperArc = smoothstep(0.08, 0.68, earthWorldNormal.y);
          float wordmarkRimEntry = smoothstep(-0.025, 0.16, earthWorldNormal.z);
          float wordmarkRimExit = 1.0 - smoothstep(0.38, 0.72, earthWorldNormal.z);
          float wordmarkSpill = wordmarkUpperArc * wordmarkRimEntry * wordmarkRimExit;
          float darkSideReveal = smoothstep(0.08, 0.92, nightAmount);
          vec3 wordmarkTint = vec3(0.88, 0.93, 1.0);
          vec3 dayWordmarkLight = surfaceLight * 0.12 + wordmarkTint * 0.004;
          vec3 nightWordmarkLight = diffuseColor.rgb * 0.18 + wordmarkTint * 0.025;
          vec3 wordmarkLight = mix(dayWordmarkLight, nightWordmarkLight, darkSideReveal);
          float wordmarkIntensity = mix(0.05, 0.32, darkSideReveal);
          outgoingLight += wordmarkLight * wordmarkSpill * wordmarkIntensity * uWordmarkGlowStrength;
          #include <opaque_fragment>
        `,
      );
    earthMaterial.userData.shader = shader;
  };
  earthMaterial.customProgramCacheKey = () => "live-solar-night-lights-wordmark-v4";

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.globeRadius, 192, 128),
    earthMaterial,
  );
  earth.name = "earth";
  earthGroup.add(earth);

  cloudLayer = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.globeRadius + 0.014, 192, 128),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: cloudTexture,
      transparent: true,
      opacity: 0.62,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
    }),
  );
  cloudLayer.name = "earth-clouds";
  cloudLayer.renderOrder = 1;
  earthGroup.add(cloudLayer);

  scene.add(new THREE.HemisphereLight(0x8ea7b0, 0x020406, 0.2));
  sunlight = new THREE.DirectionalLight(0xfff7e8, 2.85);
  scene.add(sunlight);
  Object.values(LOCATIONS).forEach(createMarker);

  const initialOrientation = orientationForLocation(LOCATIONS.gainesville);
  earthGroup.quaternion.copy(initialOrientation);
  state.currentQuaternion.copy(initialOrientation);
  state.targetQuaternion.copy(initialOrientation);
  updateSolarLighting();
}

function resize() {
  if (!renderer || !camera) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  state.cameraTargetZ = state.selectedId ? getFocusCameraZ() : getRestCameraZ();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (travelStars) travelStars.material.uniforms.uPixelRatio.value = pixelRatio;
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function updateFocus(now) {
  if (!state.focusActive) return;
  const duration = state.reducedMotion ? 1 : CONFIG.focusDuration;
  const progress = Math.min(1, (now - state.focusStartedAt) / duration);
  const eased = easeInOutCubic(progress);
  state.currentQuaternion.slerpQuaternions(state.focusStartQuaternion, state.targetQuaternion, eased);
  state.zoomCurrentProgress = THREE.MathUtils.lerp(state.focusStartZoomProgress, 1, eased);
  state.globeCurrentScale = THREE.MathUtils.lerp(state.focusStartGlobeScale, CONFIG.maxGlobeScale, eased);
  state.cameraCurrentZ = THREE.MathUtils.lerp(state.focusStartCameraZ, getFocusCameraZ(), eased);
  if (progress === 1) state.focusActive = false;
}

function updateMarkers(now) {
  const cameraDirection = camera.position.clone().normalize();
  earthGroup.children.forEach((child) => {
    if (!child.name.startsWith("marker-")) return;
    const worldPosition = new THREE.Vector3();
    child.getWorldPosition(worldPosition);
    const frontness = worldPosition.clone().normalize().dot(cameraDirection);
    const visible = frontness > 0.14;
    child.visible = visible;
    if (!visible) return;

    const phase = child.userData.phase;
    const cycle = (Math.sin(now * 0.0032 + phase) + 1) / 2;
    const dot = child.getObjectByName("signal-dot");
    const glow = child.getObjectByName("signal-glow");
    dot.scale.setScalar(0.82 + cycle * 0.24);
    dot.material.opacity = 0.18 + cycle * 0.82;
    glow.scale.setScalar(0.9 + cycle * 0.24);
    glow.material.opacity = 0.38 + cycle * 0.2;
  });
}

function updateWordmarkCurve() {
  const rawProgress = THREE.MathUtils.clamp((state.zoomCurrentProgress - 0.42) / 0.58, 0, 1);
  const curveProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
  if (curveProgress < 0.001) {
    ui.wordmarkPath.setAttribute("d", "M -160 92 L 1360 92");
    return;
  }

  const svg = ui.wordmarkPath.ownerSVGElement;
  const svgBounds = svg.getBoundingClientRect();
  const canvasBounds = ui.canvas.getBoundingClientRect();
  if (!svgBounds.width || !canvasBounds.width || !canvasBounds.height) return;

  const centerNdc = new THREE.Vector3(0, 0, 0).project(camera);
  const topNdc = new THREE.Vector3(0, CONFIG.globeRadius * state.globeCurrentScale, 0).project(camera);
  const centerScreenX = canvasBounds.left + ((centerNdc.x + 1) * 0.5 * canvasBounds.width);
  const centerScreenY = canvasBounds.top + ((1 - centerNdc.y) * 0.5 * canvasBounds.height);
  const topScreenY = canvasBounds.top + ((1 - topNdc.y) * 0.5 * canvasBounds.height);
  const earthRadiusPx = Math.abs(centerScreenY - topScreenY);
  const svgScale = svgBounds.width / 1200;
  const centerX = (centerScreenX - svgBounds.left) / svgScale;
  const centerY = (centerScreenY - svgBounds.top) / svgScale;
  const focusTitleGapPx = state.selectedId && window.innerWidth > 720
    ? THREE.MathUtils.clamp((1 - getLayoutScale()) * 40, 0, 16)
    : 0;
  const titleGapPx = THREE.MathUtils.clamp(svgBounds.width * 0.026, 14, 50) + focusTitleGapPx;
  const halfAngle = THREE.MathUtils.degToRad(86);
  const radiusForEarth = (earthRadiusPx + titleGapPx) / svgScale;
  const baseRadius = Math.max(365, radiusForEarth);
  const visibleText = ui.wordmark.querySelector(".wordmark__text");
  const measuredTextLength = visibleText?.getComputedTextLength() || 0;
  const requiredPathLength = measuredTextLength * 1.28;
  const targetRadius = Math.max(baseRadius, requiredPathLength / (2 * halfAngle));
  const arcCenterY = centerY + (targetRadius - baseRadius);
  const targetHalfChord = targetRadius * Math.sin(halfAngle);
  const targetEdgeY = arcCenterY - targetRadius * Math.cos(halfAngle);
  const targetSagitta = targetRadius * (1 - Math.cos(halfAngle));

  const leftX = THREE.MathUtils.lerp(-160, centerX - targetHalfChord, curveProgress);
  const rightX = THREE.MathUtils.lerp(1360, centerX + targetHalfChord, curveProgress);
  const edgeY = THREE.MathUtils.lerp(92, targetEdgeY, curveProgress);
  const sagitta = targetSagitta * curveProgress;
  const halfChord = (rightX - leftX) / 2;
  const radius = (halfChord * halfChord + sagitta * sagitta) / (2 * sagitta);
  ui.wordmarkPath.setAttribute(
    "d",
    `M ${leftX.toFixed(2)} ${edgeY.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${rightX.toFixed(2)} ${edgeY.toFixed(2)}`,
  );
}

function updateZoomInterface() {
  const progress = THREE.MathUtils.smoothstep(state.zoomCurrentProgress, 0, 1);
  const layoutScale = getLayoutScale();
  const wordmarkScale = THREE.MathUtils.lerp(1.1, 0.96, progress);
  const wordmarkY = THREE.MathUtils.lerp(28, -8, progress) * layoutScale;
  const accentGlowFade = 1 - THREE.MathUtils.smoothstep(state.zoomCurrentProgress, 0.26, 0.78);
  const suffixPresence = 1 - THREE.MathUtils.smoothstep(state.zoomCurrentProgress, 0.24, 0.58);
  const suffixFontSize = 0.52 * suffixPresence;
  const suffixGap = 0.18 * suffixPresence;
  ui.wordmark.style.setProperty("--wordmark-scale", wordmarkScale.toFixed(3));
  ui.wordmark.style.setProperty("--wordmark-y", `${wordmarkY.toFixed(1)}px`);
  ui.wordmark.style.setProperty("--accent-glow-opacity", (accentGlowFade * 0.82).toFixed(3));
  const earthShader = earthMaterial?.userData.shader;
  if (earthShader?.uniforms.uWordmarkGlowStrength) {
    const planetGlowFade = THREE.MathUtils.smoothstep(progress, 0.82, 1);
    const planetGlowPresence = Math.pow(planetGlowFade, 2.4);
    earthShader.uniforms.uWordmarkGlowStrength.value = planetGlowPresence;
  }
  ui.wordmarkSuffixes.forEach((suffix) => {
    const opacity = suffix.classList.contains("wordmark__accent-color")
      ? suffixPresence * accentGlowFade * 0.82
      : suffixPresence;
    suffix.style.fontSize = `${suffixFontSize.toFixed(3)}em`;
    suffix.style.opacity = opacity.toFixed(3);
    suffix.setAttribute("dx", `${suffixGap.toFixed(3)}em`);
  });

  const guideVisible = state.zoomCurrentProgress <= 0.2 && !state.selectedId;
  ui.guide.classList.toggle("is-hidden", !guideVisible);
  ui.guide.setAttribute("aria-hidden", String(!guideVisible));
}

function animate(now = 0) {
  frameId = requestAnimationFrame(animate);
  const focusWasActive = state.focusActive;
  updateFocus(now);
  earthGroup.quaternion.copy(state.currentQuaternion);
  if (cloudLayer && !state.reducedMotion) {
    cloudLayer.rotation.y = (now / CONFIG.cloudRotationPeriodMs) * Math.PI * 2;
  }
  updateSolarLighting();
  if (state.selectedId && Date.now() >= nextLocalTimeUpdateAt) updateLocationLocalTime();
  if (!focusWasActive) {
    state.zoomCurrentProgress += (state.zoomProgress - state.zoomCurrentProgress) * (state.reducedMotion ? 1 : 0.075);
    state.globeCurrentScale += (state.globeTargetScale - state.globeCurrentScale) * (state.reducedMotion ? 1 : 0.075);
    state.cameraCurrentZ += (state.cameraTargetZ - state.cameraCurrentZ) * (state.reducedMotion ? 1 : 0.075);
  }
  earthGroup.scale.setScalar(state.globeCurrentScale);
  earthStar.material.opacity = Math.max(0, 0.92 * (1 - state.zoomCurrentProgress / 0.085));
  earthStar.visible = earthStar.material.opacity > 0.01;
  updateZoomInterface();
  updateWordmarkCurve();
  camera.position.z = state.cameraCurrentZ;
  skySphere.position.copy(camera.position);
  skySphere.quaternion.slerp(state.currentQuaternion, state.reducedMotion ? 1 : 0.024);
  updateTravelStars(state.zoomCurrentProgress);
  updateMarkers(now);
  renderer.render(scene, camera);
}

function rotateFromDelta(deltaX, deltaY) {
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * CONFIG.dragSpeed);
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * CONFIG.dragSpeed);
  state.currentQuaternion.premultiply(yaw).premultiply(pitch).normalize();
  state.targetQuaternion.copy(state.currentQuaternion);
  state.focusActive = false;
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  state.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
  ui.stage.setPointerCapture(event.pointerId);

  if (state.activePointers.size >= 2) {
    const [first, second] = [...state.activePointers.values()];
    state.pinching = true;
    state.dragging = false;
    state.dragged = true;
    state.pinchDistance = first.distanceTo(second);
    ui.stage.classList.remove("is-dragging");
    state.focusActive = false;
    if (state.selectedId) closePanel();
    return;
  }

  state.dragging = true;
  state.dragged = false;
  state.pointerId = event.pointerId;
  state.previousPointer.set(event.clientX, event.clientY);
  ui.stage.classList.add("is-dragging");
}

function onPointerMove(event) {
  if (state.activePointers.has(event.pointerId)) {
    state.activePointers.get(event.pointerId).set(event.clientX, event.clientY);
  }

  if (state.pinching && state.activePointers.size >= 2) {
    const [first, second] = [...state.activePointers.values()];
    const nextDistance = first.distanceTo(second);
    const distanceDelta = nextDistance - state.pinchDistance;
    state.pinchDistance = nextDistance;
    if (distanceDelta > 0) alignFirstZoomToFlorida();
    state.zoomProgress = THREE.MathUtils.clamp(
      state.zoomProgress + distanceDelta * CONFIG.pinchProgressRate,
      0,
      1,
    );
    state.globeTargetScale = globeScaleFromProgress(state.zoomProgress);
    return;
  }

  if (!state.dragging || event.pointerId !== state.pointerId) return;
  const deltaX = event.clientX - state.previousPointer.x;
  const deltaY = event.clientY - state.previousPointer.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 2) {
    state.dragged = true;
    if (state.selectedId) closePanel();
  }
  rotateFromDelta(deltaX, deltaY);
  state.previousPointer.set(event.clientX, event.clientY);
}

function onPointerUp(event) {
  const endedPinch = state.pinching;
  state.activePointers.delete(event.pointerId);
  if (ui.stage.hasPointerCapture(event.pointerId)) ui.stage.releasePointerCapture(event.pointerId);

  if (endedPinch) {
    state.pinching = state.activePointers.size >= 2;
    state.pinchDistance = 0;
    state.dragging = false;
    state.pointerId = null;
    ui.stage.classList.remove("is-dragging");
    return;
  }

  if (event.pointerId !== state.pointerId) return;
  state.dragging = false;
  state.pointerId = null;
  ui.stage.classList.remove("is-dragging");
  if (!state.dragged) selectMarkerAtPointer(event);
}

function onWheel(event) {
  event.preventDefault();
  state.focusActive = false;
  if (event.deltaY < 0) alignFirstZoomToFlorida();
  if (state.selectedId) {
    closePanel();
    state.zoomProgress = 1;
  }
  state.zoomProgress = THREE.MathUtils.clamp(
    state.zoomProgress - event.deltaY * CONFIG.scrollProgressRate,
    0,
    1,
  );
  state.globeTargetScale = globeScaleFromProgress(state.zoomProgress);
}

function selectMarkerAtPointer(event) {
  const bounds = ui.canvas.getBoundingClientRect();
  state.pointerNdc.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(state.pointerNdc, camera);
  const visibleTargets = markerHitTargets.filter((target) => target.parent.visible);
  const intersection = raycaster.intersectObjects(visibleTargets, false)[0];
  if (intersection) focusLocation(intersection.object.userData.locationId);
}

function focusLocation(locationId, { preserveBlogUrl = false } = {}) {
  const location = LOCATIONS[locationId];
  if (!location) return;
  state.initialZoomAligned = true;
  closeDrawer({ preserveBlogUrl });

  state.focusStartQuaternion.copy(state.currentQuaternion);
  state.focusStartZoomProgress = state.zoomCurrentProgress;
  state.focusStartGlobeScale = state.globeCurrentScale;
  state.focusStartCameraZ = state.cameraCurrentZ;
  state.targetQuaternion.copy(orientationForLocation(location));
  state.focusStartedAt = performance.now();
  state.focusActive = true;
  state.zoomProgress = 1;
  state.globeTargetScale = CONFIG.maxGlobeScale;
  state.cameraTargetZ = getFocusCameraZ();
  state.selectedId = locationId;
  transitionWordmarkTo(locationId === "tokyo" ? JAPANESE_WORDMARK : ENGLISH_WORDMARK);

  ui.kicker.textContent = location.kicker;
  updateLocationLocalTime();
  ui.heading.textContent = location.heading;
  ui.subheading.textContent = location.subheading;
  ui.detail.textContent = location.detail;
  ui.description.textContent = location.description;
  ui.actions.replaceChildren(...location.actions.map((action) => {
    const button = document.createElement("button");
    button.className = "text-button";
    button.type = "button";
    button.textContent = action.label;
    button.dataset.drawer = action.drawerId;
    return button;
  }));
  ui.panel.classList.add("is-open");
  ui.panel.setAttribute("aria-hidden", "false");
  ui.locationLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.location === locationId));

  window.setTimeout(() => ui.panelClose.focus({ preventScroll: true }), state.reducedMotion ? 0 : 430);
}

function renderPrivateBlog() {
  const activeRoute = readBlogRoute();
  const categories = JAPANESE_BLOG_CATEGORIES.map((category, categoryIndex) => {
    const categoryEntries = category.entries || [];
    const categoryDetails = document.createElement("details");
    categoryDetails.className = "blog-category";
    categoryDetails.open = categoryIndex === 0 || activeRoute?.categoryId === category.id;

    const categorySummary = document.createElement("summary");
    const categoryName = document.createElement("span");
    categoryName.textContent = category.name;
    categorySummary.append(categoryName);

    const entriesContainer = document.createElement("div");
    entriesContainer.className = "blog-category__entries";
    if (!categoryEntries.length) {
      const empty = document.createElement("p");
      empty.className = "blog-category__empty";
      empty.textContent = "No entries in this category yet.";
      entriesContainer.append(empty);
    } else {
      categoryEntries.forEach((entry) => {
        const entryDetails = document.createElement("details");
        entryDetails.className = `blog-entry${entry.media?.length ? " blog-entry--media" : ""}`;
        entryDetails.dataset.blogCategory = category.id;
        entryDetails.dataset.blogEntry = entry.id;
        const entrySummary = document.createElement("summary");
        const entryTitle = document.createElement("span");
        entryTitle.textContent = entry.title;
        entrySummary.append(entryTitle);

        const content = document.createElement("div");
        content.className = "blog-entry__content";
        const body = document.createElement("div");
        body.className = "blog-entry__body";
        const paragraphs = Array.isArray(entry.body) ? entry.body : [entry.body];
        paragraphs.forEach((paragraph) => {
          const copy = document.createElement("p");
          copy.className = "blog-entry__paragraph";
          copy.textContent = paragraph;
          body.append(copy);
        });

        if (entry.glossary?.length) {
          const glossary = document.createElement("dl");
          glossary.className = "blog-entry__glossary";
          entry.glossary.forEach(([japanese, english]) => {
            const term = document.createElement("dt");
            term.textContent = japanese;
            const definition = document.createElement("dd");
            definition.textContent = english;
            glossary.append(term, definition);
          });
          body.append(glossary);
        }

        if (entry.media?.length) {
          content.classList.add("blog-entry__content--editorial");
          const leftRail = document.createElement("div");
          leftRail.className = "blog-entry__rail blog-entry__rail--left";
          const rightRail = document.createElement("div");
          rightRail.className = "blog-entry__rail blog-entry__rail--right";

          entry.media.forEach((media) => {
            const frame = document.createElement("figure");
            frame.className = `blog-entry__image blog-entry__image--${media.side}${media.caption ? ` blog-entry__image--caption-${media.captionPosition}` : ""}`;
            const imageFrame = document.createElement("div");
            imageFrame.className = "blog-entry__image-frame";
            if (media.aspectRatio) imageFrame.style.aspectRatio = media.aspectRatio;
            const image = document.createElement("img");
            image.src = media.src;
            image.alt = media.label;
            image.loading = "lazy";
            image.decoding = "async";
            imageFrame.append(image);

            if (media.caption) {
              const caption = document.createElement("figcaption");
              caption.className = "blog-entry__caption";
              caption.textContent = media.caption;
              if (media.captionPosition === "above") frame.append(caption, imageFrame);
              else frame.append(imageFrame, caption);
            } else {
              frame.append(imageFrame);
            }
            (media.side === "right" ? rightRail : leftRail).append(frame);
          });
          content.append(leftRail, body, rightRail);
        } else {
          content.append(body);
        }

        entryDetails.append(entrySummary, content);
        entryDetails.addEventListener("toggle", () => {
          if (entryDetails.open) {
            ui.drawerContent.querySelectorAll(".blog-entry[open]").forEach((openEntry) => {
              if (openEntry !== entryDetails) openEntry.open = false;
            });
            const currentRoute = readBlogRoute();
            const isCurrentRoute = currentRoute?.categoryId === category.id && currentRoute.entryId === entry.id;
            writeBlogRoute(category.id, entry.id, { replace: isCurrentRoute });
          } else {
            const currentRoute = readBlogRoute();
            if (currentRoute?.categoryId === category.id && currentRoute.entryId === entry.id) {
              clearBlogRoute();
            }
          }
          ui.drawer.classList.toggle(
            "has-expanded-entry",
            Boolean(ui.drawerContent.querySelector(".blog-entry[open]")),
          );
        });
        entryDetails.open = activeRoute?.categoryId === category.id && activeRoute.entryId === entry.id;
        entriesContainer.append(entryDetails);
      });
    }

    categoryDetails.append(categorySummary, entriesContainer);
    return categoryDetails;
  });
  ui.drawerContent.replaceChildren(...categories);
  const openEntry = ui.drawerContent.querySelector(".blog-entry[open]");
  ui.drawer.classList.toggle("has-expanded-entry", Boolean(openEntry));
  if (openEntry) {
    window.requestAnimationFrame(() => openEntry.scrollIntoView({ block: "nearest" }));
  }
}

function renderMusicReviews() {
  const entriesContainer = document.createElement("div");
  entriesContainer.className = "music-review-list";

  MUSIC_REVIEW_CATEGORIES.forEach((category) => {
    category.entries.forEach((entry) => {
      const review = document.createElement("details");
      review.className = "music-review";
      review.dataset.musicReview = entry.id;

      const summary = document.createElement("summary");
      const cover = document.createElement("img");
      cover.className = "music-review__cover";
      cover.src = entry.image;
      cover.alt = entry.imageAlt;
      cover.loading = "lazy";
      cover.decoding = "async";

      const identity = document.createElement("span");
      identity.className = "music-review__identity";
      const title = document.createElement("strong");
      title.className = "music-review__title";
      title.textContent = entry.title;
      const artist = document.createElement("span");
      artist.className = "music-review__artist";
      artist.textContent = entry.artist;
      identity.append(title, artist);

      const rating = document.createElement("strong");
      rating.className = "music-review__rating";
      rating.textContent = entry.rating;
      summary.append(cover, identity, rating);

      const body = document.createElement("div");
      body.className = "music-review__body";
      const description = document.createElement("p");
      description.className = "music-review__description";
      description.textContent = entry.description;
      body.append(description);
      review.append(summary, body);

      review.addEventListener("toggle", () => {
        if (review.open) {
          ui.drawerContent.querySelectorAll(".music-review[open]").forEach((openReview) => {
            if (openReview !== review) openReview.open = false;
          });
        }
        ui.drawer.classList.toggle(
          "has-expanded-entry",
          Boolean(ui.drawerContent.querySelector(".music-review[open]")),
        );
      });
      entriesContainer.append(review);
    });
  });

  ui.drawerContent.replaceChildren(entriesContainer);
  ui.drawer.classList.remove("has-expanded-entry");
}

function renderDrawerContent(drawerId) {
  const drawer = DRAWERS[drawerId];
  if (!drawer) return;
  if (drawer.supportsBlog) {
    renderPrivateBlog();
    return;
  }
  if (drawer.supportsMusicReviews) {
    renderMusicReviews();
    return;
  }

  if (drawer.entries?.length) {
    const cards = drawer.entries.map((entry) => {
      const card = document.createElement(entry.href ? "a" : "article");
      card.className = `project-card${entry.href ? " project-card--linked" : ""}`;
      if (entry.href) {
        card.href = entry.href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.setAttribute("aria-label", `${entry.title}, ${entry.meta}. Opens in a new tab.`);
      }

      if (entry.image) {
        const image = document.createElement("img");
        image.className = "project-card__image";
        image.src = entry.image;
        image.alt = entry.imageAlt || "";
        image.loading = "lazy";
        image.decoding = "async";
        card.append(image);
      }

      const content = document.createElement("div");
      content.className = "project-card__content";
      const title = document.createElement("h3");
      title.textContent = entry.title;
      const meta = document.createElement("p");
      meta.className = "project-card__meta";
      meta.textContent = entry.meta;
      const description = document.createElement("p");
      description.className = "project-card__description";
      description.textContent = entry.description;
      content.append(title, meta, description);

      const attributions = entry.attributions
        ?? (entry.attribution ? [entry.attribution] : []);
      attributions.forEach((item) => {
        const attribution = document.createElement("p");
        attribution.className = "project-card__attribution";

        const sourceLink = document.createElement("a");
        sourceLink.href = item.sourceHref;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = item.sourceLabel;

        attribution.append(
          document.createTextNode(item.prefix),
          sourceLink,
        );
        if (item.licenseHref) {
          const licenseLink = document.createElement("a");
          licenseLink.href = item.licenseHref;
          licenseLink.target = "_blank";
          licenseLink.rel = "noopener noreferrer";
          licenseLink.textContent = item.licenseLabel;
          attribution.append(document.createTextNode(item.middle), licenseLink);
        } else if (item.middle) {
          attribution.append(document.createTextNode(item.middle));
        }
        if (item.suffix) attribution.append(document.createTextNode(item.suffix));
        content.append(attribution);
      });

      if (entry.linkLabel) {
        const linkLabel = document.createElement("span");
        linkLabel.className = "project-card__link-label";
        linkLabel.textContent = `${entry.linkLabel} ↗`;
        content.append(linkLabel);
      }

      card.append(content);
      return card;
    });
    ui.drawerContent.replaceChildren(...cards);
    return;
  }

  const empty = document.createElement("div");
  empty.className = "drawer-empty";
  const title = document.createElement("p");
  title.className = "drawer-empty__title";
  title.textContent = drawer.emptyTitle;
  const copy = document.createElement("p");
  copy.className = "drawer-empty__copy";
  copy.textContent = drawer.emptyCopy;
  empty.append(title, copy);
  ui.drawerContent.replaceChildren(empty);
}

function openDrawer(drawerId) {
  const drawer = DRAWERS[drawerId];
  if (!drawer) return;
  state.drawerId = drawerId;
  ui.drawerKicker.textContent = drawer.kicker;
  ui.drawerTitle.textContent = drawer.title;
  ui.drawerDescription.textContent = drawer.description;
  ui.drawerDescription.hidden = !drawer.description;
  ui.drawer.classList.toggle("is-blog", Boolean(drawer.supportsBlog || drawer.supportsMusicReviews));
  ui.drawer.classList.toggle("is-music-reviews", Boolean(drawer.supportsMusicReviews));
  ui.drawer.classList.remove("has-expanded-entry");
  renderDrawerContent(drawerId);
  ui.drawer.classList.add("is-open");
  ui.drawer.setAttribute("aria-hidden", "false");
  window.setTimeout(() => ui.drawerClose.focus({ preventScroll: true }), state.reducedMotion ? 0 : 430);
}

function closeDrawer({ restoreFocus = false, preserveBlogUrl = false } = {}) {
  const priorDrawerId = state.drawerId;
  ui.drawer.classList.remove("is-open");
  ui.drawer.classList.remove("has-expanded-entry");
  ui.drawer.setAttribute("aria-hidden", "true");
  state.drawerId = null;
  if (priorDrawerId === "japanese-blog" && !preserveBlogUrl) clearBlogRoute();
  if (restoreFocus && priorDrawerId) {
    ui.actions.querySelector(`[data-drawer="${priorDrawerId}"]`)?.focus();
  }
}

function closePanel({ restoreFocus = false } = {}) {
  const priorId = state.selectedId;
  closeDrawer();
  ui.panel.classList.remove("is-open");
  ui.panel.setAttribute("aria-hidden", "true");
  ui.locationLinks.forEach((link) => link.classList.remove("is-active"));
  state.selectedId = null;
  state.cameraTargetZ = getRestCameraZ();
  if (restoreFocus && priorId) {
    document.querySelector(`[data-location="${priorId}"]`)?.focus();
  }
}

function handleBlogRouteChange() {
  const route = readBlogRoute();
  const match = route ? findBlogEntry(route.categoryId, route.entryId) : null;
  if (!route || !match) {
    document.title = DEFAULT_DOCUMENT_TITLE;
    if (state.drawerId === "japanese-blog") closeDrawer({ preserveBlogUrl: true });
    return;
  }

  document.title = `${match.entry.title} | ${DEFAULT_DOCUMENT_TITLE}`;
  if (state.selectedId !== "tokyo") focusLocation("tokyo", { preserveBlogUrl: true });
  openDrawer("japanese-blog");
}

function bindEvents() {
  ui.stage.addEventListener("pointerdown", onPointerDown);
  ui.stage.addEventListener("pointermove", onPointerMove);
  ui.stage.addEventListener("pointerup", onPointerUp);
  ui.stage.addEventListener("pointercancel", onPointerUp);
  ui.stage.addEventListener("wheel", onWheel, { passive: false });
  ui.panelClose.addEventListener("click", () => closePanel({ restoreFocus: true }));
  ui.drawerClose.addEventListener("click", () => closeDrawer({ restoreFocus: true }));
  ui.actions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-drawer]");
    if (button) openDrawer(button.dataset.drawer);
  });
  ui.locationLinks.forEach((link) => link.addEventListener("click", () => focusLocation(link.dataset.location)));
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("hashchange", handleBlogRouteChange);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.drawerId) closeDrawer({ restoreFocus: true });
    else if (state.selectedId) closePanel({ restoreFocus: true });
  });
}

async function init() {
  try {
    if (state.reducedMotion) ui.wordmark.querySelector("svg")?.pauseAnimations();
    setLoadProgress(12, "Starting the renderer");
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      setLoadProgress(18 + (loaded / total) * 72, "Preparing the globe");
    };
    const textureLoader = new THREE.TextureLoader(manager);
    const [
      earthTexture,
      normalTexture,
      roughnessTexture,
      heightTexture,
      starsTexture,
      nightTexture,
      cloudTexture,
    ] = await Promise.all([
      textureLoader.loadAsync(chooseEarthTexture()),
      textureLoader.loadAsync("assets/earth-normal-2048.png"),
      textureLoader.loadAsync("assets/earth-roughness-2048.webp"),
      textureLoader.loadAsync("assets/earth-height-2048.webp"),
      textureLoader.loadAsync(chooseStarTexture()),
      textureLoader.loadAsync(chooseNightTexture()),
      textureLoader.loadAsync(chooseCloudTexture()),
    ]);
    setLoadProgress(92, "Positioning signals");
    setupScene(
      earthTexture,
      normalTexture,
      roughnessTexture,
      heightTexture,
      starsTexture,
      nightTexture,
      cloudTexture,
    );
    bindEvents();
    resize();
    animate();
    closeLoadingScreen();
    handleBlogRouteChange();
  } catch (error) {
    console.error(error);
    showFallback("The globe could not be loaded.");
  }
}

init();
