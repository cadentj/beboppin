import { mountFarm } from '../src/index.ts'

const el = document.getElementById('app')
if (!el) {
  throw new Error('missing #app')
}

mountFarm(el, { width: window.innerWidth, height: window.innerHeight })
