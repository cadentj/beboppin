// https://pdos.csail.mit.edu/6.1810/2025/labs/util.html
// Exercise 1: sleep

#include "kernel/types.h"
#include "kernel/param.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fs.h"
#include "kernel/fcntl.h"


char*
fmtname(char *path)
{
  char *p;

  // Find first character after last slash.
  for(p=path+strlen(path); p >= path && *p != '/'; p--)
    ;
  p++;
  return p;
}


void find(char *path, char *q, int do_exec, char *argv[]) {
  char buf[512], *p;
  int fd;
  struct dirent de;
  struct stat st;

  if ((fd = open(path, O_RDONLY)) < 0) {
    fprintf(2, "find: cannot open %s\n", path);
    return;
  }

  if (fstat(fd, &st) < 0) {
    fprintf(2, "find: cannot stat %s\n", path);
    close(fd);
    return;
  }

  switch (st.type) {
  case T_DEVICE:
    break;
  case T_FILE:
    break;
  case T_DIR:
    if (strlen(path) + 1 + DIRSIZ + 1 > sizeof buf) {
      printf("find: path too long\n");
      break;
    }
    strcpy(buf, path);
    p = buf + strlen(buf);
    *p++ = '/';
    while (read(fd, &de, sizeof(de)) == sizeof(de)) {
      if (de.inum == 0)
        continue;
      memmove(p, de.name, DIRSIZ);
      p[DIRSIZ] = 0;
      if (stat(buf, &st) < 0) {
        printf("find: cannot stat %s\n", buf);
        continue;
      }

      if (
        strcmp(fmtname(buf), ".") == 0 
        || strcmp(fmtname(buf), "..") == 0
      ) continue;
      
      // Recurse into directories
      if (st.type == T_DIR) find(buf, q, do_exec, argv);

      // Print files that match the query
      if (strcmp(fmtname(buf), q) != 0) continue;

      if (do_exec == 0) { 

        // &argv[sizeof(argv)] = buf;
        
        // if (fork() == 0) { 
        //   close(0);
        //   exec(argv[0], argv + 1);
        //   exit(0);
        // } else { 
        //   wait(0);
        // }

        // inside the match + do_exec block:
        char *eargv[MAXARG];
        int i;
        for (i = 0; argv[i] && i + 1 < MAXARG; i++)
          eargv[i] = argv[i];
        eargv[i] = buf;      // matched path, e.g. "./a/b"
        eargv[i + 1] = 0;
        if (fork() == 0) {
          exec(eargv[0], eargv);
          fprintf(2, "find: exec %s failed\n", eargv[0]);
          exit(1);
        }
        wait(0);

      } else {
        printf("%s\n", buf);
      }
    }
    break;
  }
  close(fd);
}

int main(int argc, char *argv[]) {
  if (argc < 3) {
    fprintf(3, "usage: find <path_to_search> <path_to_find>\n");
    exit(1);
  }

  find(
    argv[1], 
    argv[2], 
    argc > 3 ? 0 : 1, 
    argc > 3 ? argv + 4 : 0
  );
  exit(0);
}