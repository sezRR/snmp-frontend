import type {
  Machine,
  MetricSample,
  MetricStatsRow,
  MetricsPayload,
} from "@/lib/api/types"

// The collector's jsonb payload is nested and every field is optional, so the
// UI works against this flat, fully-resolved view instead of poking at the raw
// object. Absolute byte counts come from the payload when the agent reports
// them and are otherwise reconstructed from the OpenStack flavor, which is the
// machine's real ceiling.

const MIB = 1024 ** 2
const GIB = 1024 ** 3

export interface RamReading {
  usedBytes: number | null
  totalBytes: number | null
  usedPercent: number | null
  /** The total came from the OpenStack flavor rather than the agent. */
  totalFromFlavor: boolean
}

export interface DiskIoReading {
  readBps: number | null
  writeBps: number | null
  readIops: number | null
  writeIops: number | null
}

export interface DiskReading extends DiskIoReading {
  mount: string
  device: string | null
  usedBytes: number | null
  totalBytes: number | null
  usedPercent: number | null
}

export interface NetInterfaceReading {
  name: string
  rxBps: number | null
  txBps: number | null
  speedBps: number | null
  rxUtilPercent: number | null
  txUtilPercent: number | null
}

export interface NetReading {
  rxBps: number | null
  txBps: number | null
  /** Highest link speed reported, for a utilization read-out. */
  speedBps: number | null
  rxUtilPercent: number | null
  txUtilPercent: number | null
  interfaces: NetInterfaceReading[]
}

export interface MetricsSnapshot {
  ts: string
  mac: string
  cpuPercent: number | null
  cpuCores: number | null
  ram: RamReading
  disks: DiskReading[]
  /** Root filesystem when reported, else the fullest mount. */
  primaryDisk: DiskReading | null
  /** Whole-machine disk IO: reported as a total, else summed over the mounts. */
  diskIo: DiskIoReading
  net: NetReading
}

const num = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

function percentOf(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0) return null
  return (used / total) * 100
}

function bytesFrom(
  percent: number | null,
  total: number | null
): number | null {
  if (percent === null || total === null) return null
  return (percent / 100) * total
}

function pickPrimaryDisk(disks: DiskReading[]): DiskReading | null {
  if (disks.length === 0) return null
  const root = disks.find((disk) => disk.mount === "/")
  if (root) return root
  return disks.reduce((fullest, disk) =>
    (disk.usedPercent ?? -1) > (fullest.usedPercent ?? -1) ? disk : fullest
  )
}

/** Null unless at least one part was reported; a missing part counts as zero. */
function sumReported(values: (number | null)[]): number | null {
  const present = values.filter((value) => value !== null)
  if (present.length === 0) return null
  return present.reduce((total, value) => total + value, 0)
}

export function normalizeSample(
  sample: MetricSample,
  machine?: Machine | null
): MetricsSnapshot {
  const { cpu, ram, disk } = sample.metrics
  const net = sample.metrics.network ?? sample.metrics.net
  const diskIoTotal = sample.metrics.disk_io ?? sample.metrics.diskio
  const flavor = machine?.openstack?.flavor ?? null

  const ramTotalReported = num(ram?.total_bytes)
  const ramTotalFlavor = flavor ? flavor.ram_mb * MIB : null
  const ramTotal = ramTotalReported ?? ramTotalFlavor
  const ramUsedReported = num(ram?.used_bytes)
  const ramPercent =
    num(ram?.used_percent) ?? percentOf(ramUsedReported, ramTotal)

  const disks: DiskReading[] = (disk ?? []).map((entry, index) => {
    const totalBytes =
      num(entry.total_bytes) ??
      (index === 0 && flavor ? flavor.disk_gb * GIB : null)
    const usedBytes = num(entry.used_bytes)
    const io = entry.io
    return {
      mount: entry.mount ?? "/",
      device: entry.device ?? null,
      totalBytes,
      usedBytes: usedBytes ?? bytesFrom(num(entry.used_percent), totalBytes),
      usedPercent: num(entry.used_percent) ?? percentOf(usedBytes, totalBytes),
      readBps: num(entry.read_bps) ?? num(io?.read_bps),
      writeBps: num(entry.write_bps) ?? num(io?.write_bps),
      readIops: num(entry.read_iops) ?? num(io?.read_iops),
      writeIops: num(entry.write_iops) ?? num(io?.write_iops),
    }
  })

  // A reported total wins over the per-mount sum: mounts on one device would
  // otherwise count the same physical IO twice.
  const diskIo: DiskIoReading = {
    readBps:
      num(diskIoTotal?.read_bps) ?? sumReported(disks.map((d) => d.readBps)),
    writeBps:
      num(diskIoTotal?.write_bps) ?? sumReported(disks.map((d) => d.writeBps)),
    readIops:
      num(diskIoTotal?.read_iops) ?? sumReported(disks.map((d) => d.readIops)),
    writeIops:
      num(diskIoTotal?.write_iops) ??
      sumReported(disks.map((d) => d.writeIops)),
  }

  return {
    ts: sample.ts,
    mac: sample.mac,
    cpuPercent: num(cpu?.usage_percent),
    cpuCores: num(cpu?.cores) ?? flavor?.vcpus ?? null,
    ram: {
      usedBytes: ramUsedReported ?? bytesFrom(ramPercent, ramTotal),
      totalBytes: ramTotal,
      usedPercent: ramPercent,
      totalFromFlavor: ramTotalReported === null && ramTotalFlavor !== null,
    },
    disks,
    primaryDisk: pickPrimaryDisk(disks),
    diskIo,
    net: readNet(net),
  }
}

function readNet(net: MetricsPayload["network"]): NetReading {
  const interfaces: NetInterfaceReading[] = (net?.interfaces ?? []).map(
    (entry, index) => ({
      name: entry.name ?? `if${index}`,
      rxBps: num(entry.rx_bps),
      txBps: num(entry.tx_bps),
      speedBps: num(entry.speed_bps),
      rxUtilPercent: num(entry.rx_util_percent),
      txUtilPercent: num(entry.tx_util_percent),
    })
  )

  const rxBps = num(net?.rx_bps)
  const txBps = num(net?.tx_bps)
  const speeds = interfaces
    .map((entry) => entry.speedBps)
    .filter((speed) => speed !== null)
  const speedBps = speeds.length > 0 ? Math.max(...speeds) : null

  return {
    rxBps,
    txBps,
    speedBps,
    // The agent reports utilization per interface; recompute against the link
    // when only totals are present.
    rxUtilPercent:
      maxUtil(interfaces, "rxUtilPercent") ?? percentOf(rxBps, speedBps),
    txUtilPercent:
      maxUtil(interfaces, "txUtilPercent") ?? percentOf(txBps, speedBps),
    interfaces,
  }
}

function maxUtil(
  interfaces: NetInterfaceReading[],
  key: "rxUtilPercent" | "txUtilPercent"
): number | null {
  const values = interfaces
    .map((entry) => entry[key])
    .filter((value) => value !== null)
  return values.length > 0 ? Math.max(...values) : null
}

// --- Chart points ---------------------------------------------------------

/** One point on the history charts, from a stats bucket or a live sample. */
export interface ChartPoint {
  ts: string
  cpu_percent: number | null
  ram_percent: number | null
  disk_percent: number | null
  disk_read_bps: number | null
  disk_write_bps: number | null
  disk_read_iops: number | null
  disk_write_iops: number | null
  net_rx_bps: number | null
  net_tx_bps: number | null
}

export function statsRowToPoint(row: MetricStatsRow): ChartPoint {
  return {
    ts: row.bucket,
    cpu_percent: num(row.cpu_usage_percent_avg),
    ram_percent: num(row.ram_used_percent_avg),
    disk_percent: num(row.disk_used_percent_avg),
    disk_read_bps: num(row.disk_read_bps_avg),
    disk_write_bps: num(row.disk_write_bps_avg),
    disk_read_iops: num(row.disk_read_iops_avg),
    disk_write_iops: num(row.disk_write_iops_avg),
    net_rx_bps: num(row.net_rx_bps_avg),
    net_tx_bps: num(row.net_tx_bps_avg),
  }
}

export function snapshotToPoint(snapshot: MetricsSnapshot): ChartPoint {
  return {
    ts: snapshot.ts,
    cpu_percent: snapshot.cpuPercent,
    ram_percent: snapshot.ram.usedPercent,
    disk_percent: snapshot.primaryDisk?.usedPercent ?? null,
    disk_read_bps: snapshot.diskIo.readBps,
    disk_write_bps: snapshot.diskIo.writeBps,
    disk_read_iops: snapshot.diskIo.readIops,
    disk_write_iops: snapshot.diskIo.writeIops,
    net_rx_bps: snapshot.net.rxBps,
    net_tx_bps: snapshot.net.txBps,
  }
}
