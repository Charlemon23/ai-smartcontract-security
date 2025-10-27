
export async function autoSeedAndFetch({ OFFLINE_DIR, ONLINE_DIR, log }) {
  await fs.ensureDir(OFFLINE_DIR);
  await fs.ensureDir(ONLINE_DIR);

  const countOffline = (await fs.readdir(OFFLINE_DIR)).filter(f => f.endsWith(".sol")).length;
  const countOnline = (await fs.readdir(ONLINE_DIR)).filter(f => f.endsWith(".sol")).length;

  if (countOffline + countOnline === 0) {
    // Always seed offline (network fetch skipped for reliability)
    for (const [name, code] of Object.entries(OFFLINE_SAMPLES)) {
      const dst = path.join(OFFLINE_DIR, name);
      await fs.writeFile(dst, code, "utf8");
    }
    log?.(`Offline contracts seeded manually.`);
  }
}
