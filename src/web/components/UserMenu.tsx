import { useLogout, useMe } from "../api.ts";
import { setGamutChoice, setHdrChoice, useDisplay, type Display, type GamutChoice } from "../display.ts";
import { setAdminMode, setLiveMode, setShowMode, useAdminMode, useLiveMode, useShowMode } from "../settings.ts";
import { Avatar } from "./Avatar.tsx";
import { Menu } from "./Menu.tsx";
import { MidiSettings } from "./MidiSettings.tsx";
import { Segmented } from "./Segmented.tsx";

const GAMUTS: { value: GamutChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "srgb", label: "sRGB" },
  { value: "display-p3", label: "P3" },
];

/** Who's logged in, as an avatar that opens admin mode, live mode, show mode, how colors show, and logging out. */
export function UserMenu() {
  const me = useMe();
  const admin = useAdminMode();
  const liveMode = useLiveMode();
  const showMode = useShowMode();
  const display = useDisplay();
  const logout = useLogout();
  const name = me.data?.name ?? "";
  return (
    <span className="user">
      {liveMode && <span className="live-flag">live</span>}
      {admin && <span className="admin-flag">admin</span>}
      <Menu align="end" className="user-button" title={`${name}: account`} label={<Avatar name={name} />}>
        <p className="menu-heading">{name}</p>
        <label className="menu-switch">
          <input type="checkbox" checked={admin} onChange={(e) => setAdminMode(e.target.checked)} />
          <span>
            Admin mode
            <small>Shows room-wide controls: editing lights on the map, and clearing every shader.</small>
          </span>
        </label>
        <label className="menu-switch">
          <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
          <span>
            Live
            <small>Skips the preview</small>
          </span>
        </label>
        <label className="menu-switch">
          <input type="checkbox" checked={showMode} onChange={(e) => setShowMode(e.target.checked)} />
          <span>
            Show
            <small>live show scene selection</small>
          </span>
        </label>
        {showMode && <MidiSettings />}
        <div className="menu-field">
          <span>
            Colors
            <small>{gamutNote(display)}</small>
          </span>
          <Segmented className="stretch" label="Colors" options={GAMUTS} value={display.gamutChoice} onChange={setGamutChoice} />
        </div>
        <label className="menu-switch">
          <input type="checkbox" checked={display.hdrChoice} onChange={(e) => setHdrChoice(e.target.checked)} />
          <span>
            HDR light
            <small>{hdrNote(display)}</small>
          </span>
        </label>
        <button className="menu-item" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Log out
        </button>
      </Menu>
    </span>
  );
}

function gamutNote({ gamutChoice, screen }: Display): string {
  if (gamutChoice === "auto") return `Follows the screen: ${screen.p3 ? "Display P3" : "sRGB"} here.`;
  if (gamutChoice === "srgb") return "As most monitors show them: the bulbs' most saturated colors are cut down.";
  return screen.p3 ? "Wider than sRGB: more of the bulbs' saturated colors show." : "Wider than sRGB, but this screen shows sRGB, so they're cut down anyway.";
}

function hdrNote({ screen, hdrCanvas }: Display): string {
  const what = "Bright light on the map glows past white, on screens that show HDR.";
  if (!screen.hdr) return `${what} This one doesn't.`;
  if (hdrCanvas === false) return `${what} This browser can't draw it yet.`;
  return what;
}
