Full course download here courtesy of Codex: https://drive.google.com/file/d/1dIUmvj5eXmo61ZZjBxh2wWXBWKeIpbp_/view?usp=sharing

# 5/16

## HW 1

https://github.com/mit-pdos/xv6-riscv/blob/riscv/user/cat.c

How does the system keep track of the connection between the string filename argv[i] passed to open(), and the resulting integer file descriptor fd? What does the integer file descriptor number refer to?


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