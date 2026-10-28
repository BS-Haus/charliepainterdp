/* The wordmark faces to choose between (see /explore.html). The site sets the name in MARK_DEFAULT unless ?type=…
   names another. weight is the big name along the bottom of the reel; small is the name in the bar; words closes up the
   word space (a mono space is a whole letter wide) */
window.MARK_DEFAULT = "libertinus";   // Charlie's serif
window.MARKS = {
  "geist-mono": { name: "Geist Mono ExtraLight", note: "Mono · Swiss", family: "Geist+Mono:wght@100..900", stack: '"Geist Mono", ui-monospace, monospace', weight: 200, small: 400, track: "0", words: "-.3em", caps: 1 },
  "inter-tight": { name: "Inter Tight ExtraLight", note: "Free · Helvetica-like", family: "Inter+Tight:wght@200;400", stack: '"Inter Tight", "Helvetica Neue", sans-serif', weight: 200, small: 400, track: "-.03em", caps: 0 },
  "geist": { name: "Geist ExtraLight", note: "Free · Swiss", family: "Geist:wght@200;400", stack: '"Geist", "Helvetica Neue", sans-serif', weight: 200, small: 400, track: "-.03em", caps: 0 },
  "hanken": { name: "Hanken Grotesk ExtraLight", note: "Free · grotesk", family: "Hanken+Grotesk:wght@200;400", stack: '"Hanken Grotesk", "Helvetica Neue", sans-serif', weight: 200, small: 400, track: "-.03em", caps: 0 },
  "saira": { name: "Saira Expanded Thin", note: "Wide · technical", family: "Saira:wdth,wght@125,100;125,400", stack: '"Saira", sans-serif', weight: 100, small: 400, stretch: "125%", track: ".02em", caps: 1 },
  "anybody": { name: "Anybody Expanded Thin", note: "Ultra-wide", family: "Anybody:wdth,wght@150,100;150,400", stack: '"Anybody", sans-serif', weight: 100, small: 400, stretch: "150%", track: "0", caps: 1 },
  "martian": { name: "Martian Mono Thin", note: "Mono · wide", family: "Martian+Mono:wdth,wght@112.5,100;112.5,400", stack: '"Martian Mono", monospace', weight: 100, small: 400, stretch: "112.5%", track: "0", words: "-.3em", caps: 1 },
  "plex-mono": { name: "IBM Plex Mono ExtraLight", note: "Mono", family: "IBM+Plex+Mono:wght@200;500", stack: '"IBM Plex Mono", monospace', weight: 200, small: 500, track: "0", words: "-.3em", caps: 1 },
  "big-shoulders": { name: "Big Shoulders Display Thin", note: "Condensed · tall", family: "Big+Shoulders+Display:wght@100;500", stack: '"Big Shoulders Display", sans-serif', weight: 100, small: 500, track: ".02em", caps: 1 },
  "josefin": { name: "Josefin Sans Thin", note: "Geometric · 1920s", family: "Josefin+Sans:wght@100;400", stack: '"Josefin Sans", sans-serif', weight: 100, small: 400, track: ".08em", caps: 1 },
  "italiana": { name: "Italiana", note: "Fine · fashion film", family: "Italiana", stack: '"Italiana", serif', weight: 400, small: 400, track: ".08em", caps: 1 },
  "cormorant": { name: "Cormorant Garamond Light", note: "Serif · title card", family: "Cormorant+Garamond:wght@300;500", stack: '"Cormorant Garamond", serif', weight: 300, small: 500, track: ".06em", caps: 1 },
  "bodoni": { name: "Bodoni Moda Italic", note: "Serif · high contrast", family: "Bodoni+Moda:ital,opsz,wght@1,96,400", stack: '"Bodoni Moda", serif', weight: 400, small: 400, track: "-.01em", caps: 0, italic: 1 },
  "libertinus": { name: "Libertinus Serif", note: "Charlie's serif", family: "", stack: '"Libertinus Serif", serif', weight: 400, small: 400, track: "-.01em", caps: 0 },
  "michroma": { name: "Michroma", note: "Microgramma's free cousin · one weight", family: "Michroma", stack: '"Michroma", sans-serif', weight: 400, small: 400, track: "0", caps: 1 }
};
// Trial cuts can't go online: they're offered when the site runs on this Mac, and their files are never committed or
// deployed. STK Bureau Sans is Smuss Type Kiosk's; Exposure is 205TF's, and its one axis is photographic exposure:
// -100 under (the ink spreads), +100 over (the hairlines break up). vary sets the axis (+30 is the sharp cut)
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  Object.assign(window.MARKS, {
    "exposure": { name: "Exposure", note: "205TF · trial", local: "Exposure", faces: [["ExposureTrialVAR.ttf", 400, "truetype"]], stack: '"Exposure", serif', weight: 400, small: 400, track: "-.01em", words: "-.04em", caps: 0, vary: '"EXPO" 30', varySmall: '"EXPO" 0' },
    "exposure-caps": { name: "Exposure, capitals", note: "205TF · trial", local: "Exposure", faces: [["ExposureTrialVAR.ttf", 400, "truetype"]], stack: '"Exposure", serif', weight: 400, small: 400, track: ".02em", words: "-.06em", caps: 1, vary: '"EXPO" 30', varySmall: '"EXPO" 0' },
    "stk-bureau": { name: "STK Bureau Sans ExtraLight", note: "Smuss Type Kiosk · trial", local: "STK Bureau Sans", faces: [["STKBureauSans-ExtraLight-Trial.otf", 200], ["STKBureauSans-Regular-Trial.otf", 400]], stack: '"STK Bureau Sans", sans-serif', weight: 200, small: 400, track: "-.015em", caps: 0 },
    "stk-bureau-caps": { name: "STK Bureau Sans ExtraLight, capitals", note: "Smuss Type Kiosk · trial", local: "STK Bureau Sans", faces: [["STKBureauSans-ExtraLight-Trial.otf", 200], ["STKBureauSans-Regular-Trial.otf", 400]], stack: '"STK Bureau Sans", sans-serif', weight: 200, small: 400, track: ".01em", caps: 1 }
  });
}
window.loadMark = function (key) {
  var t = window.MARKS[key];
  if (!t) return;
  if (t.faces) {
    var s = document.createElement("style");
    s.textContent = t.faces.map(function (f) { return '@font-face{font-family:"' + t.local + '";src:url(/fonts/' + f[0] + ') format("' + (f[2] || "opentype") + '");font-weight:' + f[1] + ';font-display:block}'; }).join("");
    document.head.appendChild(s);
    return;
  }
  if (!t.family) return;
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=" + t.family + "&display=swap";
  document.head.appendChild(l);
};
