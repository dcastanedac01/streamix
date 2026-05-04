/**
 * Streamix — EPG Parser
 * Parses XMLTV Electronic Program Guide files (gzipped or plain)
 * Format used by iptv-org/epg (completely free and open source)
 *
 * XMLTV structure:
 * <tv>
 *   <channel id="..."><display-name>...</display-name><icon src="..."/></channel>
 *   <programme start="YYYYMMDDHHMMSS +TZ" stop="..." channel="...">
 *     <title lang="es">...</title>
 *     <desc lang="es">...</desc>
 *     <category lang="es">...</category>
 *     <episode-num system="xmltv_ns">S.E.</episode-num>
 *     <icon src="..." />
 *   </programme>
 * </tv>
 */

const axios = require('axios');
const xml2js = require('xml2js');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

// ─────────────────────────────────────────────────────────────────
// DATE PARSER — XMLTV uses YYYYMMDDHHmmss +TZ format
// ─────────────────────────────────────────────────────────────────
function parseXMLTVDate(str) {
  if (!str) return null;
  try {
    // Format: "20240115143000 +0000" or "20240115143000 +0600"
    const cleaned = str.trim().replace(/\s+/g, ' ');
    const parts = cleaned.split(' ');
    const dt = parts[0];
    const tz = parts[1] || '+0000';

    const year   = dt.slice(0, 4);
    const month  = dt.slice(4, 6);
    const day    = dt.slice(6, 8);
    const hour   = dt.slice(8, 10);
    const minute = dt.slice(10, 12);
    const second = dt.slice(12, 14) || '00';

    const tzSign  = tz[0];
    const tzHour  = tz.slice(1, 3);
    const tzMin   = tz.slice(3, 5) || '00';

    const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}${tzSign}${tzHour}:${tzMin}`;
    return new Date(isoStr);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// EXTRACT TEXT — handles xml2js returning arrays or objects
// ─────────────────────────────────────────────────────────────────
function getText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    // Find Spanish first, then any
    const esEntry = node.find(n => n?.$ && (n.$.lang === 'es' || n.$.lang === 'spa'));
    const anyEntry = node[0];
    const target = esEntry || anyEntry;
    if (!target) return '';
    if (typeof target === 'string') return target;
    if (target._) return target._;
    return '';
  }
  if (node._) return node._;
  return '';
}

function getAttr(node, attr) {
  if (!node || !node.$) return '';
  return node.$[attr] || '';
}

// ─────────────────────────────────────────────────────────────────
// EPISODE NUMBER PARSER
// ─────────────────────────────────────────────────────────────────
function parseEpisodeNum(epNums) {
  if (!epNums || !epNums.length) return { season: null, episode: null };

  for (const ep of epNums) {
    const system = getAttr(ep, 'system') || (ep.$ ? ep.$.system : '');
    const val = getText(ep);

    if (system === 'xmltv_ns' && val) {
      // Format: "S.E.P" (0-based)
      const parts = val.split('.');
      const season  = parts[0] ? parseInt(parts[0].trim()) + 1 : null;
      const episode = parts[1] ? parseInt(parts[1].trim()) + 1 : null;
      if (season || episode) return { season, episode };
    }

    if (system === 'onscreen' && val) {
      // Format: "S01E05" or "1x05"
      const match = val.match(/[Ss](\d+)[Ee](\d+)/) || val.match(/(\d+)[xX](\d+)/);
      if (match) return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }
  }

  return { season: null, episode: null };
}

// ─────────────────────────────────────────────────────────────────
// PARSE XMLTV CONTENT (string)
// Returns { channels: Map<id, ChannelInfo>, programs: Map<channelId, Program[]> }
// ─────────────────────────────────────────────────────────────────
async function parseXMLTV(xmlContent) {
  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: false,
    explicitCharkey: true,
    charkey: '_',
  });

  let result;
  try {
    result = await parser.parseStringPromise(xmlContent);
  } catch (err) {
    throw new Error(`XML parse error: ${err.message}`);
  }

  const tv = result?.tv;
  if (!tv) return { channels: new Map(), programs: new Map() };

  // ── Parse channels ──────────────────────────────────────────────
  const channels = new Map();
  for (const ch of (tv.channel || [])) {
    const id = ch.$?.id || '';
    if (!id) continue;

    const names = (ch['display-name'] || []).map(getText).filter(Boolean);
    const icon  = ch.icon?.[0]?.$?.src || '';
    const url   = ch.url?.[0] ? getText(ch.url[0]) : '';

    channels.set(id, {
      id,
      name: names[0] || id,
      altNames: names.slice(1),
      icon,
      url,
    });
  }

  // ── Parse programmes ────────────────────────────────────────────
  const programs = new Map();
  const now = Date.now();
  const cutoff = now + 7 * 24 * 60 * 60 * 1000; // 7 days ahead

  for (const prog of (tv.programme || [])) {
    const channelId = prog.$?.channel || '';
    if (!channelId) continue;

    const start = parseXMLTVDate(prog.$.start);
    const stop  = parseXMLTVDate(prog.$.stop);
    if (!start) continue;

    // Skip past programs (more than 30 min ago) and far future (>7 days)
    if (stop && stop.getTime() < now - 30 * 60 * 1000) continue;
    if (start.getTime() > cutoff) continue;

    const { season, episode } = parseEpisodeNum(prog['episode-num']);

    const program = {
      channelId,
      title:       getText(prog.title),
      subtitle:    getText(prog['sub-title']),
      description: getText(prog.desc),
      category:    getText(prog.category),
      icon:        prog.icon?.[0]?.$?.src || '',
      start:       start.toISOString(),
      stop:        stop ? stop.toISOString() : null,
      duration:    stop ? Math.round((stop - start) / 60000) : null, // minutes
      season,
      episode,
      isLive:      start <= new Date() && stop > new Date(),
      isNew:       prog.new !== undefined,
      rating:      prog.rating?.[0] ? getText(prog.rating[0].value) : null,
    };

    if (!programs.has(channelId)) programs.set(channelId, []);
    programs.get(channelId).push(program);
  }

  // Sort programs by start time
  for (const [id, progs] of programs.entries()) {
    programs.set(id, progs.sort((a, b) => new Date(a.start) - new Date(b.start)));
  }

  console.log(`[EPG] Parsed ${channels.size} channels, ${[...programs.values()].reduce((s, p) => s + p.length, 0)} programs`);
  return { channels, programs };
}

// ─────────────────────────────────────────────────────────────────
// FETCH + PARSE EPG (handles .gz files)
// ─────────────────────────────────────────────────────────────────
async function fetchEPG(url) {
  try {
    const response = await axios.get(url, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Streamix/1.0)' },
    });

    let content;
    const buf = Buffer.from(response.data);
    const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;

    if (isGzip) {
      const decompressed = await gunzip(buf);
      content = decompressed.toString('utf-8');
    } else {
      content = buf.toString('utf-8');
    }

    return parseXMLTV(content);
  } catch (err) {
    console.error(`[EPG] Failed to fetch ${url}: ${err.message}`);
    return { channels: new Map(), programs: new Map() };
  }
}

// ─────────────────────────────────────────────────────────────────
// MERGE MULTIPLE EPG SOURCES
// ─────────────────────────────────────────────────────────────────
async function fetchAllEPG(urls) {
  console.log(`[EPG] Fetching from ${urls.length} sources...`);
  const mergedChannels = new Map();
  const mergedPrograms = new Map();

  const results = await Promise.allSettled(urls.map(url => fetchEPG(url)));

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { channels, programs } = result.value;

    for (const [id, ch] of channels) {
      if (!mergedChannels.has(id)) mergedChannels.set(id, ch);
    }

    for (const [id, progs] of programs) {
      if (!mergedPrograms.has(id)) {
        mergedPrograms.set(id, progs);
      } else {
        // Merge without duplicates (by start time)
        const existing = mergedPrograms.get(id);
        const existingStarts = new Set(existing.map(p => p.start));
        const newProgs = progs.filter(p => !existingStarts.has(p.start));
        mergedPrograms.set(id, [...existing, ...newProgs].sort((a, b) => new Date(a.start) - new Date(b.start)));
      }
    }
  }

  return { channels: mergedChannels, programs: mergedPrograms };
}

// ─────────────────────────────────────────────────────────────────
// GET CURRENT + NEXT PROGRAM FOR A CHANNEL
// ─────────────────────────────────────────────────────────────────
function getCurrentProgram(channelId, programsMap) {
  const progs = programsMap.get(channelId);
  if (!progs || !progs.length) return { current: null, next: null };

  const now = new Date();

  const currentIdx = progs.findIndex(p => {
    const start = new Date(p.start);
    const stop  = p.stop ? new Date(p.stop) : null;
    return start <= now && (!stop || stop > now);
  });

  if (currentIdx === -1) {
    // Find next upcoming
    const next = progs.find(p => new Date(p.start) > now);
    return { current: null, next: next || null };
  }

  return {
    current: progs[currentIdx],
    next:    progs[currentIdx + 1] || null,
  };
}

// ─────────────────────────────────────────────────────────────────
// ENRICH LIVE CHANNELS WITH EPG DATA
// ─────────────────────────────────────────────────────────────────
function enrichWithEPG(channels, epgData) {
  const { channels: epgChannels, programs } = epgData;

  return channels.map(ch => {
    // Try to find EPG channel by tvg-id, tvg-name, or display name
    let epgId = ch.tvgId;

    // If no direct match, try fuzzy match on name
    if (!epgId || !programs.has(epgId)) {
      const name = (ch.name || ch.tvgName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [id, epgCh] of epgChannels) {
        const epgName = (epgCh.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (epgName === name || id.toLowerCase().replace(/[^a-z0-9]/g, '') === name) {
          epgId = id;
          break;
        }
      }
    }

    if (!epgId || !programs.has(epgId)) return ch;

    const { current, next } = getCurrentProgram(epgId, programs);
    const epgCh = epgChannels.get(epgId);

    return {
      ...ch,
      epgId,
      tvgLogo: ch.tvgLogo || epgCh?.icon || ch.tvgLogo,
      currentProgram: current,
      nextProgram: next,
    };
  });
}

module.exports = {
  parseXMLTV,
  fetchEPG,
  fetchAllEPG,
  getCurrentProgram,
  enrichWithEPG,
};
