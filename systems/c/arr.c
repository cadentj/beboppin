/*
## Dynamic array (“vector”)

**Core idea:** one struct owns a heap buffer; track **`len`** (elements in use) and **`cap`** (allocated slots). Grow when `len == cap`.

**Typical fields**

- `T *data` (or `uint8_t *` for a byte buffer)
- `size_t len`
- `size_t cap`

**Grow strategy:** when full, `new_cap = cap ? cap * 2 : 8` (or start at 4/8). Multiply sizes by `sizeof(T)` when calling `realloc`.

**API sketch**

- `init`, `free`
- `push` / `pop` (optional)
- maybe `reserve` (ensure cap without changing len)
- optionally `get_ptr_at(&v, i)` **only if** you don’t realloc between use — or document “no pointers into `data` across push”

**Pitfalls**

- **`realloc` invalidates old pointers** — don’t stash `T*` into elements across a grow unless you know nothing reallocated.
- Check **`realloc` return** before assigning (don’t overwrite your only pointer with NULL on failure).
- For POD structs it’s easy; for **`char*` inside structs** you need clear ownership rules.
*/

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

typedef struct {
    int *data;
    size_t len;
    size_t cap;
} Vec_int;

Vec_int vec_int_make(int cap) {
    // NOTE(cadentj): 0 will convert to a NULL pointer in data. 
    Vec_int v = {0};
    size_t n = (cap <= 0) ? 8 : (size_t)cap;

    v.data = malloc(n * sizeof *v.data);
    if (!v.data) {
        return v;
    }
    v.cap = n;
    v.len = 0;
    return v;
}

/* NOTE(cadentj): 
Documenting a silly thing I had here. 

I was previously checking (v->len + 1 == v->cap) which is meh.

Since if v->len == v->cap when push is called, then + 1 means that the array isn't resized. 

In practice, this is fine because the array would just be resized an element early. But it's cleaner to resize when the array actually needs to be.
*/
bool vec_int_push(Vec_int *v, int n) {
    // Assume that v->cap is never 0

    if (v->len == v->cap) { 
        // New cap is 2x the size of the old one
        size_t new_cap = v->cap * 2;
        int *temp = realloc(v->data, new_cap * sizeof *v->data);

        // Check whether the realloc was valid
        if (!temp) {
            return false;
        }

        v->data = temp;
        v->cap = new_cap;

        puts("Did a realloc!");
    }

    // Then set the last element to n
    v->data[v->len] = n;
    // Increment len
    v->len++;
    return true;
}


int main(void) {
    Vec_int v = vec_int_make(10);
    if (!v.data) {
        return 1;
    }

    for (int i = 0; i < 20; i++) {
        bool res = vec_int_push(&v, i);
        if (!res) {
            puts("BROKEN");
            free(v.data);
            return 1;
        }
        printf("Pushed %d\n", i);
    }

    free(v.data);
    return 0;
}