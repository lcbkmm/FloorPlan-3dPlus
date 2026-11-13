/* Expose classic-script lexical bindings on window so ES-module view3d
 * can resolve them as free variables (let/const are not visible to modules).
 * Reassigned lets use getters/setters so reads stay live. */
(function bridge3dGlobals(){
  const g = window;
  function live(name, get, set){
    Object.defineProperty(g, name, {
      configurable: true,
      enumerable: false,
      get,
      set,
    });
  }
  live('LANG', () => LANG, v => { LANG = v; });
  live('state', () => state, v => { state = v; });
  live('view', () => view, v => { view = v; });
  live('WALLS', () => WALLS, v => { WALLS = v; });
  live('WINS', () => WINS, v => { WINS = v; });
  live('DOORS', () => DOORS, v => { DOORS = v; });
  live('SLIDES', () => SLIDES, v => { SLIDES = v; });
  live('ROOMS', () => ROOMS, v => { ROOMS = v; });
  live('BOUNDS', () => BOUNDS, v => { BOUNDS = v; });
  live('CAD_UNDERLAY', () => CAD_UNDERLAY, v => { CAD_UNDERLAY = v; });
  live('planFlags', () => planFlags, v => { planFlags = v; });

  // Stable const / object refs (not reassigned as a whole)
  g.COARSE = COARSE;
  g.TAP = TAP;
  g.$ = $;
  g.tr = tr;
  g.ui = ui;
  g.MATS = MATS;
  g.LIB = LIB;
  g.WALLPAPERS = WALLPAPERS;
  g.esc = esc;
  g.nm = nm;
  g.snap = snap;
  g.getF = getF;
  g.area = area;
  g.stairsStyleOf = stairsStyleOf;
  g.furnFinishOf = furnFinishOf;
  g.doorFinishOf = doorFinishOf;
  g.cabinetHMm = cabinetHMm;
  g.LAMP_TONES = LAMP_TONES;
  g.LAMP_TYPES = LAMP_TYPES;
  g.lampToneOf = lampToneOf;
  g.LAMP_DEFAULT_H = LAMP_DEFAULT_H;
  g.LAMP_HANG = LAMP_HANG;
  g.lampHeightOf = lampHeightOf;
  g.lampLiftOf = lampLiftOf;
})();
