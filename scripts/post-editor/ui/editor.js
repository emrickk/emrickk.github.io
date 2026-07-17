// Editor page behavior. Same-origin with the dev server, so the preview
// iframe is scriptable: language switching sets data-lang directly (the
// mechanism LangToggle.astro uses) plus localStorage so reloads persist.
const state = {
  posts: [],
  changed: new Set(),
  post: null,
  tab: null,
  files: {},
  activePath: null,
  saving: false,
}

const $ = (id) => document.getElementById(id)
const listEl = $('post-list')
const editorEl = $('editor')
const previewEl = $('preview')
const saveEl = $('save')
const tabsEl = $('tabs')
const bannerEl = $('banner')
const filterEl = $('filter')

async function api(url, options) {
  const res = await fetch('/_edit/api' + url, options)
  return { status: res.status, body: await res.json() }
}

function tabPath(post, which) {
  return which === 'primary' ? post.path : post.siblingPath
}

function tabLang(post, which) {
  if (which === 'primary') return post.lang
  return post.lang === 'zh' ? 'en' : 'zh'
}

function isDirty() {
  const f = state.files[state.activePath]
  return f ? editorEl.value !== f.savedContent : false
}

function confirmDiscard() {
  return !isDirty() || window.confirm('Discard unsaved changes to this file?')
}

function showBanner(text) {
  bannerEl.replaceChildren(document.createTextNode(text))
  bannerEl.hidden = false
}

function hideBanner() {
  bannerEl.hidden = true
  bannerEl.replaceChildren()
}

function isChanged(post) {
  return state.changed.has(post.path) || (post.siblingPath && state.changed.has(post.siblingPath))
}

function postButton(post) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'post-item' + (state.post === post ? ' active' : '')
  const title = document.createElement('span')
  title.textContent = post.titleZh || post.title
  const meta = document.createElement('small')
  meta.textContent = post.pubDate + (post.draft ? ' · draft' : '')
  btn.append(title, meta)
  btn.addEventListener('click', () => openPost(post))
  return btn
}

function renderList() {
  const q = filterEl.value.trim().toLowerCase()
  const match = (p) =>
    !q ||
    p.slug.toLowerCase().includes(q) ||
    (p.title || '').toLowerCase().includes(q) ||
    (p.titleZh || '').toLowerCase().includes(q) ||
    (p.titleEn || '').toLowerCase().includes(q)
  const changed = state.posts.filter((p) => isChanged(p) && match(p))
  const rest = state.posts.filter((p) => !isChanged(p) && match(p))
  const nodes = []
  const heading = (text) => {
    const h = document.createElement('h2')
    h.textContent = text
    return h
  }
  nodes.push(heading('Changed'))
  if (changed.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'Nothing changed vs origin/main.'
    nodes.push(empty)
  } else {
    nodes.push(...changed.map(postButton))
  }
  nodes.push(heading('All posts'))
  nodes.push(...rest.map(postButton))
  listEl.replaceChildren(...nodes)
}

function renderTabs() {
  tabsEl.replaceChildren()
  const post = state.post
  if (!post) return
  const tabs = post.siblingPath ? ['primary', 'sibling'] : ['primary']
  for (const which of tabs) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tab' + (state.tab === which ? ' active' : '')
    const name = tabPath(post, which).split('/').pop()
    btn.textContent = which === state.tab && isDirty() ? name + ' *' : name
    btn.addEventListener('click', () => {
      if (which !== state.tab) openTab(which)
    })
    tabsEl.append(btn)
  }
}

function updateDirtyUi() {
  saveEl.disabled = !state.activePath || !isDirty()
  renderTabs()
}

function setPreviewLang(lang) {
  localStorage.setItem('lang', lang)
  const doc = previewEl.contentDocument
  if (doc && doc.documentElement) doc.documentElement.setAttribute('data-lang', lang)
}

async function openTab(which) {
  if (!confirmDiscard()) return
  const post = state.post
  const path = tabPath(post, which)
  const prevTab = state.tab
  const prevPath = state.activePath
  state.tab = which
  state.activePath = path
  if (!state.files[path]) {
    const { status, body } = await api('/file?path=' + encodeURIComponent(path))
    if (status !== 200) {
      showBanner('Could not load ' + path + ': ' + body.error)
      state.tab = prevTab
      state.activePath = prevPath
      return
    }
    state.files[path] = { hash: body.hash, savedContent: body.content }
  }
  editorEl.value = state.files[path].savedContent
  editorEl.disabled = false
  hideBanner()
  setPreviewLang(tabLang(post, which))
  updateDirtyUi()
}

async function openPost(post) {
  if (!confirmDiscard()) return
  state.post = post
  state.files = {}
  state.activePath = null
  previewEl.src = '/posts/' + post.slug + '/'
  await openTab('primary')
  renderList()
}

async function refreshChanged() {
  const { status, body } = await api('/posts')
  if (status !== 200) return
  state.changed = new Set(body.changed)
  renderList()
}

function showConflict(path, body) {
  bannerEl.replaceChildren()
  const msg = document.createElement('span')
  msg.textContent = path + ' changed on disk while you were editing.'
  const reload = document.createElement('button')
  reload.type = 'button'
  reload.textContent = 'Reload from disk'
  reload.addEventListener('click', () => {
    if (!window.confirm('Replace your editor text with the file on disk?')) return
    const f = state.files[path]
    f.hash = body.currentHash
    f.savedContent = body.currentContent
    if (state.activePath === path) editorEl.value = body.currentContent
    hideBanner()
    updateDirtyUi()
  })
  const overwrite = document.createElement('button')
  overwrite.type = 'button'
  overwrite.textContent = 'Overwrite'
  overwrite.addEventListener('click', () => {
    state.files[path].hash = body.currentHash
    hideBanner()
    save()
  })
  bannerEl.append(msg, reload, overwrite)
  bannerEl.hidden = false
}

function reloadPreview() {
  try {
    previewEl.contentWindow.location.reload()
  } catch {
    // Cross-origin fallback: re-setting src reloads the iframe.
    const src = previewEl.src
    previewEl.src = src
  }
}

async function pageHtml(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return await res.text()
  } catch {
    return null
  }
}

// When the dev server's watcher is healthy, Astro HMR reloads the page on
// its own within a second or two. This poll makes the fallback exact (reload
// once the server actually serves different content) and turns a wedged
// watcher, a known gotcha when several sessions run dev servers, into a
// visible warning instead of a silently stale preview.
async function refreshPreviewAfterSave(url, htmlBeforeSave) {
  if (htmlBeforeSave === null) {
    setTimeout(reloadPreview, 1000)
    return
  }
  for (let waited = 0; waited < 8000; waited += 500) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const now = await pageHtml(url)
    if (now !== null && now !== htmlBeforeSave) {
      reloadPreview()
      return
    }
  }
  reloadPreview()
  showBanner(
    'The preview has not picked up this change after 8 seconds. The save is on disk, ' +
      'but the dev server watcher looks wedged: restart your dev server to get live previews back.',
  )
}

async function save() {
  const path = state.activePath
  const f = state.files[path]
  if (!f || !isDirty()) return
  if (state.saving) return
  state.saving = true
  saveEl.disabled = true
  // Captured once: keystrokes typed during the round trip must stay dirty,
  // so savedContent below gets this snapshot, never a re-read of the editor.
  const content = editorEl.value
  const previewUrl = state.post ? '/posts/' + state.post.slug + '/' : null
  const htmlBeforeSave = previewUrl ? await pageHtml(previewUrl) : null
  try {
    const { status, body } = await api('/file', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, content, baseHash: f.hash }),
    })
    if (status === 409) {
      showConflict(path, body)
      return
    }
    if (status !== 200) {
      showBanner('Save failed: ' + body.error)
      return
    }
    f.hash = body.hash
    f.savedContent = content
    hideBanner()
    refreshChanged()
    if (previewUrl) refreshPreviewAfterSave(previewUrl, htmlBeforeSave)
  } finally {
    state.saving = false
    updateDirtyUi()
  }
}

async function init() {
  const { status, body } = await api('/posts')
  if (status !== 200) {
    showBanner('Could not load posts: ' + body.error)
    return
  }
  state.posts = body.posts
  state.changed = new Set(body.changed)
  renderList()
}

filterEl.addEventListener('input', renderList)
editorEl.addEventListener('input', updateDirtyUi)
saveEl.addEventListener('click', save)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
})
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) e.preventDefault()
})
init()
