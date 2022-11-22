# Sockety - comparison benchmark

To test the performance of Sockety protocol and implementation, this benchmarks allows running different benchmarking suites both locally, and remotely.

## Usage

Initially, you may need to run `npm run build-sockety`, so all TypeScript packages in this repository will be built.

Afterwards, run `node index` script with proper params.

```
Usage: node index [options]

Options:
  -t, --time <ms>             Duration for each benchmark (default: "5s")
  -s, --servers <count>       Number of server workers (default: 1)
  -c, --clients <count>       Number of client workers (default: "servers * 2")
  -cc, --concurrency <count>  Concurrency for each client (default: 250)
  -cn, --connections <count>  Connections maintained for each client (default: 2)
  -w, --warming <ms>          Warming duration for each benchmark (default: 0)
  -f, --filter [filter...]    Filter benchmarks to run
  -e, --exclude [exclude...]  Exclude benchmarks to run
  -r, --remote <host>         Remote host where server is running
  -p, --port <port>           Port on which server should be (or is) available
  --server-only               Run in mode where only server is started, no benchmarking performed
  -h, --help                  display help for command
```

## Filtering

There are two options to filter suites:

* `-f` - select some suites, i.e. `-f sockety`
* `-e` - exclude some filtered suites, i.e. `-e tls`

As an example, you may run `-f sockety -e tls` to run suites related to Sockety, without TLS layer.

## Running locally

To run locally, you may set up clients and servers in a single command:

```bash
node index -c 4 -cc 100 -cn 1 -w 1s -t 3s -f http/2 -f sockety -e tls
```

## Running remotely

To run remotely, you need to set up one instance as a server (with `--server-only` and optionally `--port` arguments):

```bash
node index -f sockety -e tls --server-only --port 3333
```

To call the clients to benchmark it, you need to pass `--remote` and `--host` arguments (i.e. `--host 192.168.0.10 --port 3333`)

```bash
node index -c 4 -cc 100 -cn 1 -w 1s -t 3s -f sockety -e tls --remote 192.168.0.10 --port 3333
```
