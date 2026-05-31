// https://pdos.csail.mit.edu/6.1810/2025/labs/util.html
// Exercise 2: sixfive

#include "kernel/fcntl.h" // File control package for macros
#include "kernel/types.h"
#include "user/user.h"

void sixfive(int fd) {
  char buf[1];

  int value = 0, in_num = 0;

  while (1) {
    int n = read(fd, buf, sizeof(buf));
    if (n <= 0)
      break; // end of file?

    // Is not one of the separator characters
    if (strchr(" -\r\t\n./,", buf[0]) == 0
    && strchr("0123456789", buf[0]) != 0) {
      in_num = 1;
      if (value == 0) {
        value = buf[0] - '0';
      } else {
        value *= 10;
        value += buf[0] - '0';
      }
    } else {
      if (
        (value % 6 == 0 || value % 5 == 0)
        && (in_num == 1)
      ) {
        printf("%d\n", value);
      }
      in_num = 0;
      value = 0;
    }
  }

  if (value % 6 == 0 || value % 5 == 0) {
    printf("%d\n", value);
  }
}

int main(int argc, char *argv[]) {
  if(argc <= 1){
    sixfive(0);
    exit(0);
  }

  int fd, i;

  for(i = 1; i < argc; i++){
    if((fd = open(argv[i], O_RDONLY)) < 0){
      fprintf(2, "sixfive: cannot open %s\n", argv[i]);
      exit(1);
    }
    sixfive(fd);
    close(fd);
  }

  exit(0);
}