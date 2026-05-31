// https://pdos.csail.mit.edu/6.1810/2025/labs/util.html
// Exercise 1: sleep

#include "kernel/types.h"
#include "user/user.h"

int
main(int argc, char *argv[])
{
    if(argc != 2) { 
        fprintf(2, "usage: sleep <ticks>\n");
        exit(1);
    }

    int duration = atoi(argv[1]);
    pause(duration);
    exit(0);
}