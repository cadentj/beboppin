Full course download here courtesy of Codex: https://drive.google.com/file/d/1dIUmvj5eXmo61ZZjBxh2wWXBWKeIpbp_/view?usp=sharing

# xv6 Book

## Chapter 1 of the xv6 Book

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

