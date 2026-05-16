i havent written c in a while im refreshing here

## 5/15

- oml i forgot how pointers work. some notes for myself: 
```c
// here, declare int x
int x = 7

// then we create a pointer. 
// int *p and int* p mean the same thing, "pointer to an int"

// the ampersand gets the mem address of x
int *p = &x
int* p = &x

// prepending a variable with * is a unary dereference
// basically "follow this pointer, give me the object it points to"
// so here we get the object at memory address p and set it to 10!
*p = 10
```

- something like `int *p = 10` is not valid because we're trying to set some int 10 to p which holds an address

- we can also set a pointer to `NULL` or `0`. `0` converts to a null pointer in C, it's just a language rule.

Caden: woah, learning C is a lot easier for me than when i did it in 9th grade. i remember being really confused about pointers.

- for pointers to data types, you can use indexing which will start writing / reading at `i * data type` memory address. for example: 
```c
int *data = malloc(10 * sizeof(int))
data[2] = 3
```
^ note here, indexing a pointer will automatically unary deref to get the object. so `data[2]` is equivalent to `*(data + i)`. this is also a bit confusing because i guess, if you add an int to some pointer it will, under the hood, do like `i * sizeof(int)` and add to the start of data.

- weird thing. if `int *data = malloc(size)`, since `data` is a pointer to an `int`, `*v.data` is read as a unary deref to the first element to the memory. so `*v.data = 5` is equivalent to `v.data[0] = 5`

- following from above, there's some crazy stuff with pointers to arrays
```c
// this is a pointer to an array of integers
int (*p)[10];

// this is an array of pointers
int *q[10];

// lets say we malloc'd p
int (*p)[10] = malloc(20 * sizeof(int));
// p + 1 skips a whole row of memory size 10 * sizeof(int)
p + 1;
// this is useful if we want to have dense matrices with one malloc

// we CANNOT malloc q though
// instead, you would malloc each element of q
for (int i = 0; i < 10; i++)
    q[i] = malloc(...);   /* each row separate */
// q is useful if we want a ragged / dynamic array

// q + 1 is the next element in the pointer array
q + 1
```