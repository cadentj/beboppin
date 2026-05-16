Feeling i've been having lately: 

- woah this tool is really cool. 
  - Modal - really fast container starts, GPU snapshotting, serverless GPU runtimes, a really wonderful SDK.
  - UV - really fast package resolution and installation.
  - Ruff, Ty, Bun, Vite - the community speaks really highly of these! They're a lot faster than my naive usage of the alternatives too!
  - Firecracker - apparently this powers a lot of serverless runtimes like Daytona. They're fast, woah!

How do these systems work? Some common black boxes among them: 
- They use Rust
- They seem to know a lot about stuff like distributed systems, databases, OS
- They...?

I'd like to spend some time getting familiar here. A cute goal of mine is to build the infrastructure for a "country of geniuses in a datacenter". Couple of reasons that there's a lot of room for good solutions here: 
- I expect that current systems will need to be far more robust and scalable in the next couple of years. Take Github for example. It's struggled to keep up with agentic coding, leading prominent developers like Mitchell Hashimoto to look for alternative, more reliable solutions. 
- I think great software has only just started to emerge. For example, UV, Firecracker, etc. There's some nuiance here: 
  - These solutions are incredible, but they just weren't necessary until recently
  - These solutions simply could not have existed until recently
  - I wonder to what extent my love for these tools is because I'm coming into ~work as they're coming out. Or if they are uniquely amazing tools. I lean toward the latter. I feel like a lot of incredible software from the past like Google, web browsers, email, Linux, were fundamental and emerged out of necessity. Whereas newer tools are beautiful abstractions on top of lots of existing and some emerging technology (like GPUs) that have only emerged with more thought and research.
- People are only just starting to think about solutions here. There is so much potential! For example: 
  - Megakernels (https://hazyresearch.stanford.edu/blog/2025-05-27-no-bubbles) where people are starting to take better advantage of GPU efficiency + software.
  - Jujutsu (https://github.com/jj-vcs/jj) better version control!
  - CuTe DSL (https://docs.nvidia.com/cutlass/latest/media/docs/pythonDSL/overview.html) a Python-based DSL for CUDA development!

I think that it's worth having a **broad** and not just a deep understanding of these fields! I think that, for the next year or so the moat for human developers will be their ability to write beautiful abstractions and cross-pollinate ideas from other domains.

To get started, here's a roughly ordered set of things I'd like to do:
- Should do the OS in 1000 lines guide. Figure out how OS work!
- Should do the Compilers course
- Should learn Rust! Redo the previous two in Rust.
- Learn more about OS! 
- Learn about filesystems and build some cli tools in Rust
- Learn about distributed systems
- Do the Fly.io Gossip Glomers in Rust
- Learn async in rust
- Start reading and trying to contribute to large codebases in rust like Vite, Firecracker, etc.

## chapters

### operating systems

following along with the guide here: https://operating-system-in-1000-lines.vercel.app/en/



## aside

some other blackboxes in programming that seem super cool
- compilers! should look at stuff like Ty or TypeScript
- linear programming
- randomized algorithms
- should 