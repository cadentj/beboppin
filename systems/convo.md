how can i get practice with systems / infra work like at modal or ml sys or large scale neural network trainingwithout having access to the resources like aws, gpus, etcim thinking like. find cluster request traces online and try to build a load balancer or smtn there3:55 PMClaude responded: your load balancer instinct is right — that's essentially what modal/baseten/fireworks are scheduling against.Synthesized concrete project ideas using public cluster tracesSynthesized concrete project ideas using public cluster tracesyour load balancer instinct is right — that's essentially what modal/baseten/fireworks are scheduling against. the trick is picking traces that match the system you want to build.
traces worth knowing

azure llm inference traces (microsoft, 2023 and 2024 releases) — per-request arrival times, input/output token counts. the trace for serving infra.
alibaba PAI traces — ~6k GPU cluster, mixed training/inference jobs with arrival, GPU/mem requests, durations. great for training scheduler sims.
microsoft philly trace — training jobs on a real ML cluster, classic for gang scheduling work.
google borg traces — not ML-specific but the canonical scheduling benchmark.

project shapes that don't need real GPUs

inference serving sim. replay azure trace. implement continuous batching, paged-attention-style block allocation, prefix cache eviction policies, speculative decoding orchestration, request admission control. compare scheduling decisions to vllm's. this is the closest thing to modal infra work without hardware.
training cluster scheduler. replay alibaba/philly. FCFS → SRTF → gang → tiresias (least-attained-service) → gandiva → pollux. anchor papers: tiresias (NSDI '19), gandiva (OSDI '18), pollux (OSDI '21).
parallelism autotuner. given a model + topology + per-op FLOPS/mem/comm cost model, search over (TP, PP, DP, ZeRO-stage) configs. pure modeling — no GPUs. alpa and GSPMD are the reference points.
fake distributed training on one box. gloo on CPU lets you run real DDP/FSDP across N processes. you've done MPS — split a single GPU into contexts and do the same. implement ring all-reduce in MPI/gRPC from scratch. build toy pipeline parallel on a 124M model (gpipe/pipedream).
contribute to vllm / sglang / ray. probably highest signal for hiring — there's a public artifact reviewed by people who do this for a living. scheduler internals and kv-cache management have steady issue flow.

for occasional real-hw validation: modal credits, lambda on-demand, vast.ai, TRC for tpus (free, just apply). but most of the systems thinking — scheduling policies, cost models, cache eviction, batching heuristics — is a sim-and-trace problem, not a hardware problem.You said: anything else?anything else? how can i get good at writing stuff in rust and go at the same time, too?3:58 PMClaude responded: more sim/infra project ideasmore sim/infra project ideas

distributed kv store. build a toy raft or just chain replication. jepsen-test it yourself with fault injection. anchor: the raft paper is shockingly readable.
shuffle service / data loader. webdataset-style sharded loading with prefetch, decode pipelining, GPU-side staging. measure actual throughput on cifar/imagenette. petastorm and mosaicml's streaming are reference points.
collective comms library. ring all-reduce, tree all-reduce, 2D mesh. compare bandwidth/latency models to measured. you can do this with TCP sockets on one box across N processes.
autoscaler for serving. replay azure trace, implement predictive scaling (queue depth, p99 latency targets, cold-start penalty). this is exactly what modal's control plane does.
disaggregated prefill/decode router. model two pools with different batch dynamics, route requests, measure goodput. recent splitwise (osdi '24) / distserve papers are the reference.
profiler / flamegraph thing. parse perf/nsys output, build flame visualizations, attribute time to kernels vs comm vs python overhead. boring but everyone secretly wants better tools here.
distributed file system. even a toy GFS/HDFS clone teaches you a lot about what breaks at scale.

getting good at rust + go in parallel
honestly the fastest path is don't try to do them in parallel as language study — pick projects where each language is the obvious choice and let the difference teach you the difference.
go is right for: control planes, schedulers, anything talking to k8s, anything where you'd otherwise reach for python but want a single binary. it's deliberately boring. you'll be "productive" in a week and the language stops being interesting fast — which is the point.
rust is right for: data plane stuff. a kv-cache allocator, a tokenizer, a custom collective, anything where you'd otherwise reach for c++. the language will fight you for a month or two. lifetimes click when you stop trying to make borrowed things flow through async boundaries and just Arc<T> more aggressively at first.
concrete pairing for the projects above:

scheduler/autoscaler in go. mirrors how kueue, volcano, knative are actually built. read their source.
inference server data plane in rust. tokenizer, request queue, batch assembler. mistral.rs and candle are readable. tch-rs if you want torch bindings.
collective comms in rust. zero-cost abstractions over sockets, real ownership story for buffers.
trace replayer in either. good warmup project — parse parquet, event loop, virtual time.

books/resources that are actually worth it: rust for rustaceans (jon gjengset) once you've done the rust book. his youtube streams are the best rust content that exists. for go, 100 go mistakes skips the basics and goes straight to the things that bite you. tokio's tutorial is the only async rust intro that doesn't suck.
one warning: rust async is a different language from rust. learn sync rust solidly first (a month of CLI tools and parsers), then tokio. people who start with async hate the language.You said: async rust or goasync rust or go3:59 PMClaude responded: go, for almost everything you'd actually build.go, for almost everything you'd actually build.
goroutines + channels are the point of the language. you write blocking code, the runtime makes it concurrent, you move on. async rust gives you roughly the same concurrency model but with: function coloring, Pin, Send/Sync bounds bleeding into every signature, lifetimes that don't compose cleanly across await points, and a split ecosystem (tokio vs smol vs async-std) where libraries pick sides.
the niche where async rust wins is narrow: you need C++-level control over allocation/layout and high-concurrency IO in the same binary. inference server data plane, proxies like linkerd2-proxy, databases. if that's not what you're building, the tax isn't worth it.
practical split for your projects: scheduler, autoscaler, control plane, trace replayer → go. inference data plane, tokenizer, custom allocator, collective comms → sync rust with rayon for parallelism, only reach for tokio when you genuinely have thousands of concurrent IO-bound tasks.
if you only learn one concurrency story this year, go's.You said: Anyway, at a small startup my “do everything” background ended up being useful.Anyway, at a small startup my “do everything” background ended up being useful. I carved out a bit of an unconventional role as the most low-level and high-level engineer: I built Modal’s distributed cloud container runtime in Rust and deployed core infrastructure services at microsecond latency—but I also wrote and themed most of the frontend web app, trading off days between filesystem performance benchmarking and interface design.eric zhang wrote this in his blog, what does filesystem performance entail?curious what the progress for learning rust looks like here. im going to try doing fly io gossip glomers in rust or smtn toocan u give a concise answer w a bullet pointed progress list4:10 PMClaude responded: what filesystem perf entails at modalwhat filesystem perf entails at modal
modal's container runtime needs to load multi-GB images (python deps, model weights) into ephemeral containers in <1s. that's the problem. the work:

lazy image pulling. don't download the whole image — fetch blocks on page fault. stargz/eStargz, SOCI, nydus are the references. modal published on this.
content-addressed dedup. same layer across 1000 containers stored once, mmap'd into each. FUSE or overlayfs tricks.
userspace filesystems. FUSE perf tuning, or going lower with virtio-fs for microVMs. measuring syscall overhead, batching, readahead policies.
caching tiers. local NVMe → regional blob store → origin. eviction policies, prefetch heuristics from access traces.
cold-start path. every ms of open()/stat()/read() on the critical path matters when you're targeting sub-second boots. profile with bpftrace, perf, fio.

so "filesystem performance benchmarking" means: synthetic workloads with fio, real workloads (pip install, torch import, model load) traced with strace/bpf, measuring p50/p99 latency per syscall, finding the bottleneck, fixing it in the FUSE daemon or page cache logic.
rust progression to get there

week 1–2: rust book ch 1–17. write 3–4 CLI tools (ripgrep clone, json pretty-printer, wc). get comfortable with Result, ?, iterators, traits, Box/Rc/Arc. no async yet.
week 3–4: rust for rustaceans. one parser project with nom or hand-rolled. one project with real lifetimes (string interner, arena allocator). learn cargo, clippy, criterion for benchmarks.
week 5–6: unsafe rust + FFI. write bindings to a small C library. read the std::collections source. understand UnsafeCell, MaybeUninit, aliasing rules. miri.
week 7–8: gossip glomers in rust. echo → unique IDs → broadcast → counters → kafka → txns. this is the sync-rust distributed systems gym. use serde_json + stdin/stdout, no tokio needed for the early challenges.
week 9–10: tokio tutorial end-to-end. rewrite one glomers challenge with tokio. build a toy redis (mini-redis is the canonical exercise, jon gjengset streamed it).
week 11–12: systems-y project. pick one: io_uring wrapper, FUSE filesystem with fuser crate (passthrough → caching → content-addressed), simple block storage daemon, custom allocator with GlobalAlloc.
month 4+: read real codebases. tikv, sled, materialize, mistral.rs, candle. contribute a small PR somewhere. by now async stops feeling like a different language.

after that arc you'd have the rust chops for runtime/infra work. the filesystem-specific knowledge is mostly orthogonal — linux internals (LWN articles, the linux programming interface), FUSE docs, reading nydus/stargz source.
glomers in rust is a great call. it forces you to think about ordering, partitions, and idempotency without async getting in the way.You said: is a mini project i can do in week 3-4 building a compiler for a toy language in rustis a mini project i can do in week 3-4 building a compiler for a toy language in rust4:12 PMClaude responded: yes — actually a great fit, especially since you've already done the typescript checker so you won't be learning compilers and rust simultaneously, just rust.Assessed compiler project feasibility against Rust learning timelineAssessed compiler project feasibility against Rust learning timelineyes — actually a great fit, especially since you've already done the typescript checker so you won't be learning compilers and rust simultaneously, just rust.
it hits exactly the week 3-4 muscles: parsing (lifetimes on token slices), AST design (enums + box, the canonical rust pain point), arena allocation for nodes, visitor patterns with traits.
scoping for 2 weeks

lexer. hand-rolled, no logos crate yet — you want the lifetime practice. iterator over &str producing Token<'src>.
parser. recursive descent or pratt. pratt is more fun and teaches you trait-based precedence. operands borrow from source.
AST. this is where rust bites. enum Expr { Binary(Box<Expr>, Op, Box<Expr>), ... } works but feels bad. switch to an arena (typed-arena or roll your own Vec<Expr> + ExprId(u32)) — this is the lesson. real compilers (rustc, swc) all do this.
typechecker. you already know bidirectional. port your TS checker's core. HashMap<&str, Type> for env, work through the borrow checker pain of mutable env + recursive calls.
backend. pick one:

tree-walk interpreter (easiest, still teaches you tons)
bytecode VM (more rust-y, stack discipline maps well to vecs)
don't do LLVM via inkwell yet — fighting the C++ bindings buries the rust lessons



language to implement
keep it tiny. lambda calculus + ints + let + if is enough. or "tiny ML" with sum types if you want pattern matching practice (great rust exercise — exhaustiveness via match).
skip: modules, generics, GC, optimization passes. those are month-long detours each.
resources

bob nystrom's crafting interpreters — part II (clox) is in C but trivially portable to rust, and the design is good.
the rustc dev guide chapter on the HIR/arena pattern.
chumsky crate's docs (don't use it yet, but read how it's structured).

one practical tip: start with String everywhere, get it working, then refactor to &'src str borrows. doing lifetimes from scratch on day one of a new project is how people quit rust.You said: what is like, a college course that would teach all of this perf eng stuffwhat is like, a college course that would teach all of this perf eng stuff4:20 PMClaude responded: there isn't one course that covers it all — it's split across 3-4 in a typical curriculum, and the systems + perf combo is mostly self-taught from a few legend…there isn't one course that covers it all — it's split across 3-4 in a typical curriculum, and the systems + perf combo is mostly self-taught from a few legendary ones.
the canonical list

MIT 6.172 — performance engineering of software systems (charles leiserson). the perf course. cache-oblivious algorithms, vectorization, cilk parallelism, profiling. lectures + handouts are all online. start here.
MIT 6.5840 (formerly 6.824) — distributed systems (robert morris). raft, mapreduce, spanner, zookeeper. labs are in go. legendary. all materials public.
CMU 15-418 / stanford CS149 — parallel computing. GPU architecture, CUDA, message passing, lock-free. kayvon fatahalian's stanford version has incredible lecture videos.
CMU 15-721 — advanced database systems (andy pavlo). storage engines, query execution, concurrency control. way more relevant to infra work than it sounds — databases are where systems perf gets taken most seriously. youtube playlist is gold.
stanford CS249r / MIT 6.5940 — tinyml / efficient ML. han song's course. quantization, pruning, distillation, systems for on-device. closer to your quant capstone.
berkeley CS162 — operating systems. if you haven't done a real OS course. processes, scheduling, FS, memory. nachos/pintos labs.
CMU 15-440/640 — distributed systems (alternative to MIT's). more breadth, less depth.

the ML-systems specific stuff

stanford CS336 — language modeling from scratch (percy liang, tatsu). training infra, parallelism, kernels. brand new, materials going up.
CMU 10-714 — deep learning systems (tianqi chen, zico kolter). build a mini-pytorch + autograd + cuda kernels. videos public.
UW CSE 599W — systems for ML (older but still good, tianqi chen).

northeastern specifically

CS 3650 (you've done) covers basics. CS 4400 compilers, CS 4520 mobile, CS 5600 OS, CS 7680 special topics sometimes runs distributed/systems. nothing that maps onto 6.172 directly — that gap is normal, basically every school has it.

the missing course
nobody teaches "modal/baseten infrastructure engineering" because it's 4 years old as a discipline. the actual prep is:

6.172 for perf intuition
6.5840 for distributed
15-721 for storage/execution mental models
cs336 or 10-714 for ML-specific
read andy pavlo's reading list, the morning paper archives, sigops/osdi/nsdi/sosp proceedings

if you only do one: 6.172. it changes how you read code.You said: where is the filesystems stuff eric mentioned in these courses?where is the filesystems stuff eric mentioned in these courses?4:21 PMClaude responded: filesystems are weirdly under-taught — they sit between OS and databases and most curricula give them like 2 weeks total.filesystems are weirdly under-taught — they sit between OS and databases and most curricula give them like 2 weeks total. here's where they actually show up:
in the courses

berkeley CS162 / MIT 6.5810 (formerly 6.828) — OS. 2-3 lectures on FFS, inode design, journaling, log-structured FS (LFS). 6.828's xv6 has a real (toy) FS you implement against. this is the standard exposure most people get.
CMU 15-721 / 15-445 — databases. storage manager, buffer pool, page layout, WAL. not a filesystem but the exact same problems — block allocation, caching, durability, crash recovery. arguably better preparation for modal-style work than an OS course because the perf engineering is more aggressive.
MIT 6.5831 — database internals. even more storage-focused.
stanford CS240 / CS347 — advanced OS / distributed systems. GFS, HDFS, ceph papers. closer to what modal builds on top of.

none of these go deep on the userspace-FS-for-container-images problem eric was working on. that's research/industry territory.
the actual filesystem canon
most of the knowledge lives in papers + source, not courses:

ostep (operating systems: three easy pieces) — free book, remzi arpaci-dusseau. the persistence section (ch 36-49) is the best filesystem intro that exists. FFS, journaling, LFS, NFS, AFS, all in one place.
FAST conference proceedings (usenix file and storage tech). this is the venue. read the best-paper list.
classic papers: FFS (mckusick '84), LFS (rosenblum/ousterhout '92), soft updates, ext4 journaling, btrfs/zfs design docs, ceph (weil '06).
container-FS specifically: stargz (FAST '20-ish), nydus papers, SOCI (aws), modal's own blog posts on their image format. this is < 5 years old, no course covers it.
FUSE: "to FUSE or not to FUSE" (FAST '17) is the standard ref. then read libfuse source + a real FUSE FS like gocryptfs or rclone mount.

linux kernel side

linux kernel development (love) — gentle intro
understanding the linux kernel (bovet) — older but FS chapters still good
LWN.net articles on VFS, page cache, io_uring, fuse-passthrough. LWN is the single best resource for "what's actually happening in linux right now."

practical path to eric's level
courses won't get you there. the path is roughly:

ostep persistence section, cover to cover
build a FUSE passthrough fs in rust (fuser crate). measure overhead vs native.
add a block cache. measure with fio.
read stargz/nydus source. implement lazy pulling against a registry.
read modal/fly.io/firecracker blogs on container boot.

the "filesystem performance" job title basically doesn't exist outside a handful of companies (modal, fly, databricks, snowflake, the hyperscalers, dropbox magic pocket era). so it's not surprising no course targets it.