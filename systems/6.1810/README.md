Full course download here courtesy of Codex: https://drive.google.com/file/d/1dIUmvj5eXmo61ZZjBxh2wWXBWKeIpbp_/view?usp=sharing

# xv6 Book

## Chapter 1

### intro

- OS abstracts program design from hardware 
- a *kernel* is a special program that provides services to running programs
  - these running programs are called processes which each have memory containing instructions, data, and a stack.
    - instructions implement the program's computation
    - data are variables on which the computation is run
    - the stack organizes the program's procedure calls 
      - (question): what is this?

- when a program needs to invoke a kernel service, it invokes a system call
  - when a syscall enters the kernel, the kernel performs the service and returns
  - the kernel alternates between **user space** and **kernel space**
    - a kernel uses hardware protection mechansims provided by the CPU to ensure processes in user space can only access its own memory

this chapter details all the services provided by the xv6 kernel which are a subset of those provided by Unix kernels

a **shell** is an ordinary program that reads commands from the user and executes them. since it's a normal program in user space, there are many shell options in Unix. xv6 just uses an xv6 shell


### Processes and memory

```c
int pid = fork();
if(pid > 0){
  printf("parent: child=%d\n", pid);
  pid = wait((int *) 0);
  printf("child %d is done\n", pid);
} else if(pid == 0){
  printf("child: exiting\n");
  exit(0);
} else {
  printf("fork error\n");
}
```

silly notes by me: 
- fork returns twice, on each process branch. it returns the other branch's process id. so it returns 0 on a child, and the pid of the child on the parent. 
- wait will get the 


### Pipes

Taking note of this confusing snippet from the book. The goal is to run `wc` with standard input connected to the read end of a pipe: 

```c
pipe(p)
if(fork() == 0) {
  close(0);
  dup(p[0]);
  close(p[0]);
  close(p[1]);
  exec("/bin/wc", argv);
} {
  ...
}
```

It wasn't obvious to me why there were so many leading calls to `close()` or a call to `dup()`. Notes:
- `dup()` doesn't just create a copy of the file descriptor (e.g. fd 5 -> 5). It allocates a new fd pointing to the same kernel object! This is useful here since we first close fd 0 so when we call dup, it uses fd 0 which refers to standard input.
- Then the program closes the input and output of the pipe. Closes the input 

## Chapter 2

- `2.1` explains operating systems are useful for cooperative sharing of resources among different programs. 
  - e.g. Unix switches CPU among processes, provides service abstractions rather than direct resource access for programs 

### 2.2 User, supervisor mode and syscalls

- cpus provide built in support for isoluation. Risc-V for example has three different modes
  - machine mode which provides full priv. xv6 briefly uses this to boot the machine
  - supervisor mode where a process can exec priv instructions such as reading / writing to page table register
  - user mode, where a proc can exec only user mode instructions

an application in supervisor mode is said to be in "kernel space" while a proc in user mode is said to be in "user space

applications can interact w the kernel through syscalls. Risc-v has support with the `ecall` instr. Switchs to supervisor mode at a specified entry point, then the kernel can veify that the application is calling valid arguments, etc. 
- This validation is important since a proc that could decide its own kernel entry point might enter the kernel at a point where validation args are skipped 
- from what i understand, entry point refers to a specific line in the C code

**QUESTION(cadentj):** ^ what does "entry point" mean? mem address? line of code that a process is on?

### 2.3 Kernel Organization

NOTE(cadentj): There's this phrasing at the start where in a monolithic kernel they say "the entire OS resides in the kernel". I dont fully understand this bc I assumed that a kernel and OS are both just systems that abstract services to running applications, and are mostly interchangable. 
- Actually, I think tying this back to the previous section a kernel refers more specifically to the system that has supervisor / priviledged access (kernel space). So basically a microkernel just runs a lot of the operating system in user space, not in the kernel.

how im interpreting this is, an os is a broader abstraction for a system that abstracts services to different programs, and a kernel is a specific implementation of an operating system? unclear to me

- in a **monolithic kernel**, all syscalls run in supervisor mode
  - easier organization, don't need to divide code into parts that req different priv
  - more prone to bugs since the kernel can grow large and complex, and a bug in the kernel causes the entire computer to crash and req restart
- in a **microkernel**, a minimum amt of fcn is put into the kernel itself, so little code executes in supervisor mode. most of the os runs in user space

like most Unix operating systems, xv6 is a monolithic kernel

### 2.5 Process Overview

- processes are the unit of isolation in Unix machines that provide the illusion to running applications that they have their own machine, e.g. memory and CPU
- xv6 uses page tables provided by the hardware to give each process its own address space. Risc-v page table translates virtual addresses (instr to risc-v) to physical addresses on the CPU
- xv6 has a sepr page table for each proc that defines its address space. 
- address space is laid out as: 
  - instructions first 
  - global variables
  - stack (fcn local variables)
  - heap (dynamic memory to be allocated)
  - trampoline page (4096 bytes)
    - code to transition in and out of the kernel
  - trap page (4096 bytes)
    - saves the user's registers

- okay silly confusion by me for a bit, but essentially: 
  - risv pointers are 64 bits wide
  - hardware only uses the low 39 when looking up addr on the page table
  - xv6 only uses 38 of those
  - so the MAXVA (address space size for a proc in xv6) is 2^{38} - 1 = 0x3fffffffff
    - e.g. for each bit, there's either a 1 or a 0 so there are 2^{38} different memory addresses in a process
  - took me a bit to realize what this means: 
    - lets say an int is 4 bytes, or 32 bits. that means the int has some repr that takes up 4 bytes of memory. 
    - NOTE(Cadentj): actually im still a little confused

QUESTION(cadentj): I wonder how the hardware implements page tables. Do GPUs do this? How much faster is it for the hardware to impl page tables than code that manually does so? probably makes less sense for something like inference because page tables are per request which is the bottleneck whereas CPU processes are far more frequent and ephemeral?

- threads have two stacks, user and kernel stack. corresponding stack is used depending on whether code is executing in user or kernel space

### 2.7 Security Model

- developers assume all user code is malicious
- try their best to write bug free, careful code

# The C Programming Language

## 5.1

unary operators associate right to left, so: 

`++*p` will increment whatever p points to, but `(*p)++` parenthesis are needed for order of operations for the right side `++`

## 6.2

- variables in a structure are called members.
- can write a list of variables immediately after declaring a struct to declare instances of that struct. e.g. 

```c
struct {...} x, y, z;

// analogous to 

int x, y, z;
```

if `p` is a pointer to a struct, access and edit its members with `->`. its just shorthand for `(*p).x` since pointers to structs are so common.


# Lesson 1

## HW 1

https://github.com/mit-pdos/xv6-riscv/blob/riscv/user/cat.c

How does the system keep track of the connection between the string filename argv[i] passed to open(), and the resulting integer file descriptor fd? What does the integer file descriptor number refer to?

- String filenames are at addresses referenced by pointers in `*argv`.
- The file descriptor results from opening that address w the `open` syscall. 
- The file descriptor refers to some kernel managed object that the process can read / write to. In this case, an object the current process can read from.

## Lecture 1

URL: `https://pdos.csail.mit.edu/6.1810/2025/lec/l-overview.txt`

- xv6 is an os created specifically for the class. 
- patterned after UNIX but far simpler
- runs on a RISC-V CPU

(note): Close QEMU with `ctrl-a + x`
(note): `ctrl-d` is an end-of-input signal, `read()` will return 0.

- file descriptors (FD) are arguments passed to syscalls which denote what "open file" to read/write
- UNIX convention: FD 0 is standard input, 1 is standard output

- syscalls like `read()`, `write()`, or `open()` look like normal function calls but actually jump down into the kernel
  - when a program calls a syscall: 
    - the CPU saves some user registers
    - CPU increases privilege level
    - CPU jumps to a known entry point in the kernel and runs the sys call impl in C
    - modify kernel data structures
    - restores user registers
    - reduce priv level

- `wait()` / `exit()` was a little confusing. (In `ex5.c`)
```c
main()
{
  int pid, status;

  pid = fork();
  if(pid == 0){
    ...
    exit(1);
  } else {
    ...
    wait(&status);
  }
}
```
^ Found this super confusing. My mental model was: 
  - `fork()` is called
  - The child process runs and exits
  - The parent process reads from `&status`
But this makes 0 sense since there's no reason for `&status` to be the addr that the child writes to. The better model of process execution is: 
  - `fork()` is called
  - The parent process and child process run at the same time. 
    - The parent process hits wait and the kernel marks the process blocked
    - The child finishes and writes status to the addr that `wait()` calls
  - The kernel notifies it when the child exists and uses the data that the child process wrote

## Lab 1

### memdump

this problem required me to know the data types, printf format specifiers, and some pointer rules.

Switch statements exist in c, i think there's some nuiance to what data types you can use in the statement though.
```c
switch(x) { 
  case 1: 
    break;
  default:
    break;
}
```

data types: 
- `long` is 8 bytes --> `%ld`
- `int` is 4 bytes --> `%d`
- `short` is 2 bytes --> `%hd` (h is for half)
- `char` is one byte --> `%c`

you can also: 
- print pointers --> `%p`
- float --> `%f`
  - double --> `%lf`
- hex --> `%x`
  - long hex --> `%lx`

string stuff: 
- you can't store string literals like `"hello"` on a `char`, but you can store them in a `char*` pointer. they are read only though. to get the length of the string at pointer, use the `strlen` method on the pointer.
- you can also store strings as character arrays. you don't need to declare the length upfront, c will infer it. note, the length of the array will include the null pointer `\0`. even if you manually give a size since you don't initialize, you need to include space for the initializer, e.g. `chars[4] = "dog";`

### find

This line was a bit confusing `*dst++ = *src++;`. It does two things at once: move a byte from src to dst, then advances both pointers.

Remember that `++` or `--` before the value increment, then use the value. After the value means "use the current value, then increment".

Annoying pointer semantics again: 

```c

char buf[512], *p;

...

// p points to the memory addr for element 5
p = buf + 5

// This is invalid, it will stuff a character (e.g. 97 for 'a) into a pointer. Might still compile w a warning.
p = buf[5]

// This is valid, here we use the ampersand to get the mem addr of the element at idx 5
p = &buf[5]

// This is valid, here we set the value at p to the value at idx 5 in buf
*p = buf[5]

// This is valid, buf without an index is the addr of the first element &buf[0]
p = buf
```

### exec

C feature I find myself using is treating pointer arrays like contiguous memory. for example, having a function accept some `*char[]` and passing `argv + n` as a "slice" of the arguments.

# Lesson 2

## Lecture 2: Kernel C

Discusses some key C concepts in xv6, not a general intro to the language.

Notable things: 
- Example of single-linked list in `kernel/kalloc.c` which grabs the next free page of memory. Double-linked in `kernel/bio.c` which impl a LRU buffer cache
- Bitwise operators! Not sure how these are useful yet though.

Parts of a c program:
- text: code, read-only data
- data: global C variables
- stack: a function's local variables
- heap: dynamic memory allocation using sbrk, malloc/free

## Homework 2

```c
struct f {
  int a;
  char b[32];
};

struct g {
  char *c;
  int d[4];
};

struct h {
  struct f *f;
  struct g g;
};

struct h *h;
```

Suppose that the value of h is 0x1000. Figure out the values of the following expressions, or explain why it's not possible to figure them out:

`&h->g.d[2]`

- start at 0x1000.
- `offsetof(h, g)` is 8 --> size of pointer `*f` is 8 bytes 
- `offsetof(g, d[2])` is 16 --> `*c` is 8 bytes, `d[2]` is 8 bytes
- so this evaluates to 0x1018 since we're in hex
  - 24 is `0x18` in hex, `0x1000 + 0x18 = 0x1018` in hex

`&h->f->a`

- not determined, need the value of `f` since it's a pointer.
  - note, we can evaluate `g.c` below since we just want the address of the pointer `c`. but here, we need to evaluate `a` and we don't know the value of f to compute addr f + 8 bytes.

`&h->g.c`

- start at 0x1000.
- `offsetof(h, g)` is 8 --> `int a` is 4 bytes, `char b[32]` is 32 x 1 bit = 4 bytes
- so this evaluates to 0x1008

`&h->g.c[10]`

- cannot evaluate this. we don't know the addr of c, this is equivalent to `c + 10`

### Notes! 

**Prefixes in C**
- `0x` or `0X` -> hexadecimal
- `0` alone -> octal
- no prefix -> decimal
- `0b` or `0B` -> binary

# Lesson 3

## Lecture 3: OS Design

- can have proc isolation without h/w supported user/supervisor code and virtualmemory with strongly typed programming languages! limits the applications which can run, however

Digging into the exec syscall a bit under `kernel/sysfile.c`. Left some comments as notes on the fcn. Some top level thoughts: 
- QUESTION: why does the trapframe only have like 5 addresses? or like, in `kernel/syscall.c`, `n` in `argraw()` only fetches from 1 of 5 addresses.
- Kinda cool seeing what's been described in the book actually impl. So it grabs the user's fcn and arguments from the trapframe as `uarg` and `uargv`, then verifies them one by one and copies them into `karg` and `kargv`. to copy lements of `uargv` into `kargv` it calls `fetchstr` from `kernel/syscall.c` and `copyinstr` from `kernel/vm.c`. 
  - not 100% sure yet why fetchstr is the approach rather than like, `strcpy`? maybe bc data is being copied from user space to kernel space. im also not 100% sure either yet how C library functions work in xv6 since I guess they have to access stuff on the kernel, like how does xv6 tell C to use its heap / stack? how is it installed?

## Homework 3

For this lecture, read the following files in the xv6 kernel implementation:

kernel/proc.h
kernel/defs.h
kernel/entry.S
kernel/main.c
user/init.c
and also skim the implementation of processes in the following files:

kernel/proc.c
kernel/exec.c
Suppose that an xv6 kernel has used up all of the struct proc entries in the struct proc proc[NPROC] table (i.e., none of them have state == UNUSED). What happens if one of the processes calls exec()? What happens if one of the processes calls fork()? What happens if one of the processes calls kill() on an existing PID and then calls fork()?

You may find chapter 2 of the book useful in understanding the overall kernel structure and what a process implementation looks like.

Submit your answer in an ASCII text file named homework.txt to the corresponding "Lecture N" assignment on Gradescope.

### Impl Notes

- `.h` files are "header" files which contain definitions and declarations (and functions) shared across `.c` files in a program

`proc.h` - 
