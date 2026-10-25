// PlayStorage by sorokin — in-app user guide (EN). © Sorokin Ivan, MIT.
export default `<h2>What is PlayStorage</h2>
<p>PlayStorage is a full-screen, console-style game launcher. It gathers all the games on your PC on one screen: pick a tile and press "Play". You can use a gamepad (DualSense, Xbox) or the keyboard.</p>
<div class="note">Author: <b>Sorokin Ivan</b> (GitHub: sorokin). PlayStorage is an independent project and is not affiliated with Sony.</div>

<h2>Controls</h2>
<table>
<tr><th>Action</th><th>Gamepad</th><th>Keyboard</th></tr>
<tr><td>Move</td><td>D-pad / left stick</td><td><kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd></td></tr>
<tr><td>Confirm / select</td><td>✕ (A on Xbox)</td><td><kbd>Enter</kbd> or <kbd>Space</kbd></td></tr>
<tr><td>Back</td><td>○ (B on Xbox)</td><td><kbd>Esc</kbd> or <kbd>Backspace</kbd></td></tr>
<tr><td>Game options ("…" menu)</td><td>Options / Menu button</td><td><kbd>I</kbd> or <kbd>F2</kbd></td></tr>
<tr><td>Control Center</td><td>PS / Xbox button or Create</td><td><kbd>Tab</kbd> or <kbd>Home</kbd></td></tr>
<tr><td>Switch tab</td><td>L1 / R1</td><td><kbd>Q</kbd> / <kbd>E</kbd> or <kbd>PgUp</kbd> / <kbd>PgDn</kbd></td></tr>
<tr><td>Search</td><td>△ (Y on Xbox)</td><td><kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>F</kbd></td></tr>
<tr><td>Full screen</td><td>—</td><td><kbd>F11</kbd></td></tr>
<tr><td>Close window</td><td>—</td><td><kbd>Alt</kbd>+<kbd>F4</kbd></td></tr>
</table>
<p>You can swap the Confirm and Back buttons: Settings → Accessories → Controllers.</p>

<h2>Home screen</h2>
<ul>
<li><b>"Games" and "Media" tabs</b> are in the top-left corner. Press ↑ to reach them, or use L1/R1.</li>
<li><b>Top right:</b> search, settings, profile and clock.</li>
<li><b>Tile shelf.</b> First comes the "+" tile (add a game), then recently played games, and finally "Game Library". The selected tile grows and the background switches to the game's artwork.</li>
<li><b>Play.</b> Just press ✕ / Enter on a game tile. Or press ↓ to reach the "Play" and "…" (options) buttons.</li>
<li>Below the tile you can see your play time and the date of the last launch.</li>
</ul>

<h2>How to add games</h2>
<p>Select the "+" tile on the home screen (or Settings → Games &amp; library). There are four ways:</p>
<ol>
<li><b>Find installed games</b> — PlayStorage finds Steam and Epic Games titles by itself.</li>
<li><b>Scan my folders</b> — searches the folders you added before.</li>
<li><b>Choose a games folder</b> — pick the folder that contains your game folders (for example <code>D:\Games</code>). PlayStorage finds the right .exe in each one and skips uninstallers and helper files. The folder is remembered for future scans.</li>
<li><b>Pick an .exe manually</b> — if a game wasn't found.</li>
</ol>
<p>After searching you'll see a list of what was found. Tick the games you want (Enter) and choose "Add selected". If the wrong .exe was picked for a game, press Options (<kbd>I</kbd>) on its row and choose another file.</p>
<div class="note">Artwork is downloaded automatically from public Steam data. If none is found, PlayStorage draws its own cover from the title and the game's icon. You can pick your own image in the "…" menu → "Change cover".</div>

<h2>Game library</h2>
<ul>
<li>Tabs: <b>All games</b>, <b>Recent</b>, <b>Favorites</b> (L1/R1 or ← →).</li>
<li>The round button on the left opens <b>sort and filters</b> (name, date, play time, source: Steam / Epic / other).</li>
<li>Search by title: <kbd>/</kbd> or △.</li>
<li>The "…" menu (<kbd>I</kbd>) on any game: favorite, rename, change cover, change .exe, open folder, hide, remove from library. <b>Game files are never deleted.</b></li>
</ul>

<h2>Control Center</h2>
<p>The PS / Xbox button or <kbd>Tab</kbd> opens a bar at the bottom: home, library, sound volume (↑ ↓ change it, Enter mutes), profile, settings and <b>power</b> — sleep, restart, shut down the PC, exit PlayStorage.</p>

<h2>Settings: what is where</h2>
<table>
<tr><td><b>User guide &amp; information</b></td><td>This guide, version, author, licenses</td></tr>
<tr><td><b>Accessibility</b></td><td>Text size, bold text, contrast, color filters, reduced motion</td></tr>
<tr><td><b>Profile</b></td><td>Name and color, switch or delete profile, ask for profile at startup</td></tr>
<tr><td><b>System</b></td><td>Language (RU/EN), clock, start with Windows, free memory while playing, backup, reset</td></tr>
<tr><td><b>Storage</b></td><td>Used space on disks and the size of library games</td></tr>
<tr><td><b>Sound</b></td><td>Interface sounds and volume</td></tr>
<tr><td><b>Screen &amp; video</b></td><td>Monitor, full screen, interface scale, background dimming, cover shape</td></tr>
<tr><td><b>Accessories</b></td><td>Gamepad, button icons, confirm button, key list</td></tr>
<tr><td><b>Games &amp; library</b></td><td>Game folders, manual add, hidden games, artwork, sites for the Media tab</td></tr>
<tr><td><b>Notifications</b></td><td>Show or hide pop-up messages</td></tr>
</table>

<h2>Profiles and where data is stored</h2>
<p>Everyone can have their own profile with separate settings, language, favorites, hidden games and play time. The game library itself is shared.</p>
<p>All data lives in <code>%APPDATA%\PlayStorage</code> (open it via Run — <kbd>Win</kbd>+<kbd>R</kbd>). This folder is <b>not removed</b> when you uninstall the program, so your profiles and settings survive a reinstall.</p>
<p>One-file backup: Settings → System → Backup &amp; restore.</p>

<h2>How launching a game works</h2>
<p>When you start a game, the PlayStorage window closes (if "Free memory while playing" is on) so it doesn't use resources. A tiny background process watches the game, counts your play time and reopens the launcher automatically when the game exits.</p>

<h2>Media</h2>
<p>A tab of website shortcuts (YouTube, Twitch, Netflix, etc.). They open in your browser or in a full-screen Edge window (Settings → Games &amp; library → Media). Add your own sites with the "+" tile.</p>

<h2>Troubleshooting</h2>
<table>
<tr><td><b>Games aren't found</b></td><td>Choose the folder that contains game folders, not the Steam folder itself. Or add the .exe manually.</td></tr>
<tr><td><b>Wrong program starts</b></td><td>"…" menu → "Change .exe" and pick the main game file.</td></tr>
<tr><td><b>No cover art</b></td><td>Check your internet connection and Settings → Games &amp; library → Artwork → "Download missing artwork". For non-Steam games you can pick a cover manually.</td></tr>
<tr><td><b>Gamepad doesn't respond</b></td><td>Connect it before starting, or press any button. If Steam grabs the controller, close Steam.</td></tr>
<tr><td><b>Windows warns during installation</b></td><td>In the blue window click "More info" → "Run anyway". The installer isn't signed with a paid certificate.</td></tr>
<tr><td><b>A game needs administrator rights</b></td><td>Windows will ask for permission when it starts. Accept.</td></tr>
<tr><td><b>Interface is too small or large</b></td><td>Settings → Screen &amp; video → Interface scale.</td></tr>
</table>
<p>Author: Sorokin Ivan · PlayStorage by sorokin · MIT License.</p>`;
