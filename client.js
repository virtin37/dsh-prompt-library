/**
 * Prompt library — browser half.
 *
 * Registers a right-sidebar tab type plus a composer tool-row trigger. Templates
 * are kept in localStorage; insertion goes through the Session input facade
 * (`inputActions.captureInsertion()` + `insertText()`), which is the only
 * supported way to edit another plugin's composer draft.
 */
window.__ModuleLoader__.load({
  id: '@virtin37/dsh-prompt-library',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useMemo = React.useMemo
    const useRef = React.useRef

    const NS = 'promptLibrary'
    /** Tab kind: what `openTab` names and what the panel dispatches. */
    const TYPE_ID = 'prompt-library'
    /** Implementation identity: slot keys and the registered tab type id. */
    const DEF_ID = '@virtin37/dsh-prompt-library'
    const STORAGE_KEY = 'dsh.prompt-library.v1'

    let ctxRef = null

    /* ------------------------------------------------------------------ i18n */

    const ZH = {
      tabTitle: '提示词库',
      open: '提示词',
      guideHint: '收纳、分类、搜索提示词模板，填入变量后插入输入框',
      search: '搜索标题、内容或分组',
      new: '新建',
      newGroup: '新建分组',
      newPrompt: '在这里新建',
      renameGroup: '重命名分组',
      deleteGroup: '删除分组',
      groupMenu: '分组操作',
      save: '保存',
      cancel: '取消',
      edit: '编辑',
      delete: '删除',
      confirmDeleteItem: '删除这条提示词？',
      confirmDeleteGroup: '删除这个分组和其中的全部提示词？',
      insert: '插入到输入框',
      insertFilled: '填入并插入',
      insertRaw: '插入原文',
      fillHint: '填入本次的值',
      placeholderHint: '用【名称】标记需要填写的位置，同一名称会填到所有位置。',
      emptyTitle: '还没有提示词',
      emptyHint: '点右上角“新建”添加第一条。',
      emptyGroup: '这个分组还是空的',
      noResults: '没有匹配的提示词',
      inserted: '已插入输入框，确认后再发送',
      noSession: '当前没有会话，插入不可用；仍然可以编辑提示词。',
      errEmptyBody: '内容不能为空',
      errNoGroup: '请先新建一个分组',
      errNoSession: '没有可插入的会话',
      errBlocked: '输入框刚刚发生变化，请再点一次',
      errBusy: '消息正在发送，稍后再插入',
      errInsert: '插入失败，请重试',
      errPersist: '修改没能写入浏览器存储（可能已满），刷新后可能丢失',
      fieldTitle: '标题',
      fieldGroup: '分组',
      fieldBody: '内容',
      defaultGroup: '默认分组',
      blanks: '个空位',
      blankN: '空白',
      prev: '上一个',
      next: '下一个',
      skip: '跳过',
      sharedValue: '同名空位共用这个值',
      showAll: '全部列出',
      oneByOne: '逐个填',
      noBlanks: '没有可填的空位',
    }

    const EN = {
      tabTitle: 'Prompt library',
      open: 'Prompts',
      guideHint: 'Collect, group and search prompt templates, fill their variables, insert them into the composer',
      search: 'Search titles, content or groups',
      new: 'New',
      newGroup: 'New group',
      newPrompt: 'New here',
      renameGroup: 'Rename group',
      deleteGroup: 'Delete group',
      groupMenu: 'Group actions',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      confirmDeleteItem: 'Delete this prompt?',
      confirmDeleteGroup: 'Delete this group and every prompt in it?',
      insert: 'Insert into composer',
      insertFilled: 'Fill and insert',
      insertRaw: 'Insert as written',
      fillHint: 'Value for this run',
      placeholderHint: 'Wrap a fill-in spot as 【name】; the same name fills every occurrence.',
      emptyTitle: 'No prompts yet',
      emptyHint: 'Use “New” above to add the first one.',
      emptyGroup: 'This group is empty',
      noResults: 'No matching prompts',
      inserted: 'Inserted into the composer — send it yourself',
      noSession: 'No session is open, so insertion is unavailable; editing still works.',
      errEmptyBody: 'Content cannot be empty',
      errNoGroup: 'Create a group first',
      errNoSession: 'No session to insert into',
      errBlocked: 'The composer changed — click again',
      errBusy: 'A message is being sent; insert again in a moment',
      errInsert: 'Could not insert; try again',
      errPersist: 'Could not save to browser storage (it may be full); changes may be lost on reload',
      fieldTitle: 'Title',
      fieldGroup: 'Group',
      fieldBody: 'Content',
      defaultGroup: 'Default group',
      blanks: 'blanks',
      blankN: 'Blank',
      prev: 'Previous',
      next: 'Next',
      skip: 'Skip',
      sharedValue: 'Same-named blanks share this value',
      showAll: 'Show all',
      oneByOne: 'One by one',
      noBlanks: 'No blanks to fill',
    }

    // Fallback translator: keeps the interface readable when the locale service
    // is unavailable. apply() replaces it with the bound namespace translator.
    let t = (key) => (ZH[key] !== undefined ? ZH[key] : EN[key] !== undefined ? EN[key] : key)

    /* --------------------------------------------------------------- storage */

    function uid(prefix) {
      return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    }

    function emptyState() {
      return { version: 1, groups: [], lastValues: {} }
    }

    function seedState() {
      const state = emptyState()
      state.groups.push({
        id: uid('g_'),
        name: '示例',
        collapsed: false,
        items: [
          {
            id: uid('p_'),
            title: '需求澄清（先问再写）',
            body:
              '我现在的需求是：【需求描述】。\n\n请先不要写代码，用三个问题帮我把范围、约束和验收标准确认清楚；每个问题给出你推荐的做法。',
            updatedAt: Date.now(),
          },
          {
            id: uid('p_'),
            title: '代码审查',
            body:
              '请审查下面的改动，重点看：\n1. 边界条件与空值\n2. 未处理的异常与错误分支\n3. 是否需要同步更新测试\n\n【改动内容】',
            updatedAt: Date.now(),
          },
        ],
      })
      return state
    }

    function normalize(raw) {
      const out = emptyState()
      if (!raw || typeof raw !== 'object') return out
      const groups = Array.isArray(raw.groups) ? raw.groups : []
      for (const group of groups) {
        if (!group || typeof group !== 'object') continue
        const items = []
        for (const item of Array.isArray(group.items) ? group.items : []) {
          if (!item || typeof item.body !== 'string') continue
          items.push({
            id: typeof item.id === 'string' && item.id ? item.id : uid('p_'),
            title: typeof item.title === 'string' ? item.title : '',
            body: item.body,
            updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
          })
        }
        out.groups.push({
          id: typeof group.id === 'string' && group.id ? group.id : uid('g_'),
          name:
            typeof group.name === 'string' && group.name.trim() ? group.name : t('defaultGroup'),
          collapsed: group.collapsed === true,
          items,
        })
      }
      if (raw.lastValues && typeof raw.lastValues === 'object') out.lastValues = raw.lastValues
      return out
    }

    function readState() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return seedState()
        return normalize(JSON.parse(raw))
      } catch (err) {
        console.error('[prompt-library] could not read templates', err)
        return emptyState()
      }
    }

    function writeState(next) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return true
      } catch (err) {
        console.error('[prompt-library] could not save templates', err)
        return false
      }
    }

    let state = readState()
    const listeners = new Set()
    let persistErrorHandler = null

    function commit(next) {
      state = next
      const saved = writeState(next)
      if (!saved && persistErrorHandler) {
        try {
          persistErrorHandler()
        } catch (err) {
          console.error('[prompt-library] persist handler failed', err)
        }
      }
      for (const listener of listeners) {
        try {
          listener()
        } catch (err) {
          console.error('[prompt-library] listener failed', err)
        }
      }
    }

    function useLibrary() {
      const [snapshot, setSnapshot] = useState(state)
      useEffect(() => {
        setSnapshot(state)
        const listener = () => setSnapshot(state)
        listeners.add(listener)
        const onStorage = (event) => {
          if (event && event.key === STORAGE_KEY) {
            state = readState()
            listener()
          }
        }
        window.addEventListener('storage', onStorage)
        return () => {
          listeners.delete(listener)
          window.removeEventListener('storage', onStorage)
        }
      }, [])
      return snapshot
    }

    /* ------------------------------------------------------------ templates */

    function clone(value) {
      return JSON.parse(JSON.stringify(value))
    }

    function firstLine(text) {
      const line = String(text || '')
        .split(/\r?\n/)
        .find((entry) => entry.trim())
      return (line || '').trim().slice(0, 60)
    }

    function preview(text) {
      return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 96)
    }

    const SLOT_SOURCE = '【([^【】\\n]{0,200})】'

    /**
     * Every 【…】 occurrence, in order. Unlike a name-keyed scan this keeps empty
     * brackets, long names and repeated names apart, so the wizard can ask once
     * per occurrence and the count always matches what the author wrote.
     */
    function scanSlots(body) {
      const slots = []
      const pattern = new RegExp(SLOT_SOURCE, 'g')
      const text = String(body || '')
      let match
      while ((match = pattern.exec(text))) {
        const name = match[1].trim()
        slots.push({
          index: slots.length,
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          name,
          key: name ? 'n:' + name : 'a:' + slots.length,
        })
      }
      return slots
    }

    function slotValue(values, slot) {
      if (!values) return undefined
      if (values[slot.key] !== undefined) return values[slot.key]
      // Values saved by the first build used the bare name as the key.
      return slot.name ? values[slot.name] : undefined
    }

    /** Replace each occurrence in place; skipped or empty slots keep their brackets. */
    function assemble(body, slots, values) {
      let output = ''
      let cursor = 0
      for (const slot of slots) {
        output += body.slice(cursor, slot.start)
        const value = slotValue(values, slot)
        output += value === undefined || value === null || value === '' ? slot.raw : value
        cursor = slot.end
      }
      return output + body.slice(cursor)
    }

    function insertIntoComposer(inputActions, text) {
      if (!inputActions) return 'no-session'
      if (!text) return 'empty'
      try {
        const span = inputActions.captureInsertion()
        return inputActions.insertText(text, span) ? 'ok' : 'blocked'
      } catch (err) {
        console.error('[prompt-library] insertion failed', err)
        return 'error'
      }
    }

    function locateItem(next, itemId) {
      for (const group of next.groups) {
        const index = group.items.findIndex((item) => item.id === itemId)
        if (index >= 0) return { group, index }
      }
      return null
    }

    function removeItem(next, itemId) {
      const found = locateItem(next, itemId)
      if (!found) return false
      found.group.items.splice(found.index, 1)
      return true
    }

    /* --------------------------------------------------------------- styles */

    const CSS = [
      '.dpl-root,.dpl-root *{box-sizing:border-box}',
      '.dpl-root{display:flex;flex-direction:column;height:100%;min-height:0;font-size:var(--dsh-content-font-size,14px);line-height:1.5;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}',
      '.dpl-head{display:flex;flex-direction:column;gap:.55em;padding:.7em .85em;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.dpl-headrow{display:flex;align-items:center;gap:.55em}',
      '.dpl-title{flex:1;font-size:1em;font-weight:600}',
      '.dpl-body{flex:1;min-height:0;overflow-y:auto;padding:.55em .55em 1.6em}',
      '.dpl-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:.3em;height:2.1em;padding:0 .8em;border-radius:.55em;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:.86em;cursor:pointer;white-space:nowrap}',
      '.dpl-btn:hover{border-color:var(--dsw-alias-border-l2)}',
      '.dpl-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.dpl-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}',
      '.dpl-btn.primary:hover{filter:brightness(1.06)}',
      '.dpl-btn.ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}',
      '.dpl-btn.ghost:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.dpl-btn.danger{background:transparent;border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.dpl-btn.wide{width:100%}',
      '.dpl-input{width:100%;height:2.3em;padding:0 .75em;border-radius:.55em;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:.86em;outline:none}',
      '.dpl-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dpl-textarea{width:100%;min-height:11em;padding:.6em .75em;border-radius:.65em;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em;line-height:1.6;resize:vertical;outline:none}',
      '.dpl-textarea:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dpl-banner{margin:.55em .85em 0;padding:.45em .7em;border-radius:.55em;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:.79em}',
      '.dpl-toast{margin:.55em .85em 0;padding:.45em .7em;border-radius:.55em;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-success-primary);font-size:.79em}',
      '.dpl-toast.err{color:var(--dsw-alias-state-error-primary)}',
      '.dpl-group{margin-bottom:.3em}',
      '.dpl-ghead{display:flex;align-items:center;gap:.3em;border-radius:.6em}',
      '.dpl-gtoggle{appearance:none;flex:1;display:flex;align-items:center;gap:.45em;padding:.45em .45em;border:0;border-radius:.6em;background:transparent;color:inherit;font-family:inherit;font-size:1em;cursor:pointer;text-align:left}',
      '.dpl-gtoggle:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.dpl-caret{width:.9em;color:var(--dsw-alias-label-secondary);font-size:.71em}',
      '.dpl-gname{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpl-count{color:var(--dsw-alias-label-secondary);font-size:.79em}',
      '.dpl-icon-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:1.8em;height:1.8em;border:0;border-radius:.45em;background:transparent;color:var(--dsw-alias-label-secondary);font-size:.93em;cursor:pointer}',
      '.dpl-icon-btn:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.dpl-menu{display:flex;flex-direction:column;gap:1px;margin:.15em .3em .45em;padding:.3em;border:1px solid var(--dsw-alias-border-l1);border-radius:.6em;background:var(--dsw-alias-bg-layer-1)}',
      '.dpl-menu-item{appearance:none;border:0;border-radius:.45em;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:.86em;text-align:left;padding:.35em .6em;cursor:pointer}',
      '.dpl-menu-item:hover{background:var(--dsw-alias-bg-base)}',
      '.dpl-menu-item.danger{color:var(--dsw-alias-state-error-primary)}',
      '.dpl-inline{display:flex;align-items:center;gap:.45em;padding:.3em .3em .45em}',
      '.dpl-confirm{display:flex;align-items:center;gap:.45em;padding:.3em .45em .55em;font-size:.79em;color:var(--dsw-alias-label-secondary)}',
      '.dpl-confirm span{flex:1}',
      '.dpl-items{display:flex;flex-direction:column;gap:2px}',
      '.dpl-item{appearance:none;display:block;width:100%;padding:.5em .6em;border:1px solid transparent;border-radius:.6em;background:transparent;color:inherit;font-family:inherit;text-align:left;cursor:pointer}',
      '.dpl-item:hover{background:var(--dsw-alias-bg-layer-1)}',
      '.dpl-item.active{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}',
      '.dpl-item-title{font-size:.93em;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpl-item-sub{margin-top:2px;font-size:.79em;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpl-group-empty,.dpl-empty{padding:.7em .6em;color:var(--dsw-alias-label-secondary);font-size:.86em}',
      '.dpl-empty{padding:1.8em .85em;text-align:center}',
      '.dpl-empty-title{font-size:.93em;color:var(--dsw-alias-label-primary);margin-bottom:.3em}',
      '.dpl-empty-hint{font-size:.79em}',
      '.dpl-card{margin:.3em .15em .7em;padding:.7em;border:1px solid var(--dsw-alias-border-l1);border-radius:.7em;background:var(--dsw-alias-bg-layer-1)}',
      '.dpl-preview{white-space:pre-wrap;word-break:break-word;font-size:.86em;line-height:1.6;max-height:12em;overflow:auto;padding:.6em;border:1px solid var(--dsw-alias-border-l1);border-radius:.55em;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
      '.dpl-field{display:flex;flex-direction:column;gap:.3em;margin-top:.65em}',
      '.dpl-label{font-size:.79em;color:var(--dsw-alias-label-secondary)}',
      '.dpl-actions{display:flex;flex-wrap:wrap;gap:.45em;margin-top:.7em}',
      '.dpl-hint{margin-top:.45em;font-size:.79em;color:var(--dsw-alias-label-secondary)}',
      '.dpl-foot{padding:.7em .3em 0}',
      '.dpl-cardhead{display:flex;align-items:center;gap:.3em;margin-bottom:.55em;font-size:.79em;color:var(--dsw-alias-label-secondary)}',
      '.dpl-progress{display:flex;align-items:center;gap:.5em;margin-bottom:.5em;font-size:.79em;color:var(--dsw-alias-label-secondary)}',
      '.dpl-bar{flex:1;height:.3em;border-radius:1em;background:var(--dsw-alias-bg-base);overflow:hidden;border:1px solid var(--dsw-alias-border-l1)}',
      '.dpl-bar i{display:block;height:100%;background:var(--dsw-alias-brand-primary)}',
      '.dpl-question{font-size:1em;font-weight:600;margin-bottom:.35em}',
      '.dpl-context{white-space:pre-wrap;word-break:break-word;font-size:.79em;line-height:1.6;max-height:7em;overflow:auto;margin-bottom:.55em;padding:.45em .6em;border:1px solid var(--dsw-alias-border-l1);border-radius:.55em;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary)}',
      '.dpl-context .hl{color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.dpl-wnav{display:flex;flex-wrap:wrap;gap:.45em;margin-top:.6em}',
      '.dpl-note{margin-top:.35em;font-size:.79em;color:var(--dsw-alias-label-secondary)}',
      '.dpl-trigger{appearance:none;display:inline-flex;align-items:center;gap:.4em;height:26px;padding:0 .6em;border:1px solid transparent;border-radius:.5em;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:.86em;cursor:pointer}',
      '.dpl-trigger:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
    ].join('')

    function Styles() {
      return h('style', null, CSS)
    }

    function Glyph() {
      return h(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': true },
        h('rect', { x: 7, y: 9, width: 14, height: 2.6, rx: 1.3, fill: 'currentColor' }),
        h('rect', { x: 7, y: 16.7, width: 14, height: 2.6, rx: 1.3, fill: 'currentColor' }),
        h('rect', { x: 7, y: 24.4, width: 9, height: 2.6, rx: 1.3, fill: 'currentColor' }),
        h('path', {
          d: 'M23 7.5h7.2a1.3 1.3 0 0 1 1.3 1.3v18.6l-4.9-3.6-4.9 3.6V8.8a1.3 1.3 0 0 1 1.3-1.3Z',
          fill: 'var(--dsw-alias-brand-primary)',
        }),
      )
    }

    /* ------------------------------------------------------------ components */

    function OpenButton() {
      return h(
        'button',
        {
          type: 'button',
          className: 'dpl-trigger',
          title: t('tabTitle'),
          onClick: () => {
            try {
              if (ctxRef && ctxRef.sidebarRight) ctxRef.sidebarRight.openTab(TYPE_ID)
            } catch (err) {
              console.error('[prompt-library] could not open the tab', err)
            }
          },
        },
        h(Glyph, null),
        h('span', null, t('open')),
      )
    }

    function PromptLibraryTab(props) {
      const inputActions = props ? props.inputActions : undefined
      const useInput = props ? props.useInput : undefined
      const phase = useInput ? useInput((input) => input.phase) : 'plain'
      const library = useLibrary()
      const [query, setQuery] = useState('')
      const [expanded, setExpanded] = useState(null)
      const [editing, setEditing] = useState(null)
      const [groupMenu, setGroupMenu] = useState(null)
      const [groupPrompt, setGroupPrompt] = useState(null)
      const [confirm, setConfirm] = useState(null)
      const [values, setValues] = useState({})
      const [flash, setFlash] = useState(null)
      const [step, setStep] = useState(0)
      const [cardMode, setCardMode] = useState(null)
      const flashTimer = useRef(0)
      const stepInput = useRef(null)

      useEffect(() => {
        return () => {
          if (flashTimer.current) window.clearTimeout(flashTimer.current)
        }
      }, [])

      useEffect(() => {
        persistErrorHandler = () => {
          setFlash({ kind: 'err', text: t('errPersist') })
        }
        return () => {
          persistErrorHandler = null
        }
      }, [])

      useEffect(() => {
        if (!expanded) return
        setValues((previous) => {
          if (previous[expanded]) return previous
          return Object.assign({}, previous, {
            [expanded]: Object.assign({}, library.lastValues[expanded] || {}),
          })
        })
      }, [expanded, library])

      // Menus and prompts belong to the group list; searching replaces it.
      useEffect(() => {
        setGroupMenu(null)
        setGroupPrompt(null)
        setConfirm(null)
      }, [query])

      // A newly opened card starts at its first blank, in its default mode.
      useEffect(() => {
        setStep(0)
        setCardMode(null)
      }, [expanded])

      // Keep the caret in the blank the wizard is asking about.
      useEffect(() => {
        if (stepInput.current && document.activeElement !== stepInput.current) {
          stepInput.current.focus()
        }
      }, [step, expanded, cardMode])

      function notify(kind, text) {
        setFlash({ kind, text })
        if (flashTimer.current) window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlash(null), 2400)
      }

      const search = query.trim().toLowerCase()
      const busy = phase !== undefined && phase !== 'plain'

      const matches = useMemo(() => {
        if (!search) return null
        const found = []
        for (const group of library.groups) {
          for (const item of group.items) {
            const haystack = (item.title + '\n' + item.body + '\n' + group.name).toLowerCase()
            if (haystack.indexOf(search) >= 0) found.push({ group, item })
          }
        }
        return found
      }, [search, library])

      function toggleGroup(groupId) {
        commit({
          version: library.version,
          groups: library.groups.map((group) =>
            group.id === groupId ? Object.assign({}, group, { collapsed: !group.collapsed }) : group,
          ),
          lastValues: library.lastValues,
        })
      }

      function startNew(groupId) {
        const target = groupId || (library.groups[0] ? library.groups[0].id : '')
        setEditing({ id: null, groupId: target, title: '', body: '' })
        setExpanded(null)
        setGroupMenu(null)
        setFlash(null)
      }

      function startEdit(group, item) {
        setEditing({ id: item.id, groupId: group.id, title: item.title, body: item.body })
        setExpanded(null)
      }

      function saveEditing() {
        if (!editing) return
        const body = editing.body
        if (!body.trim()) {
          notify('err', t('errEmptyBody'))
          return
        }
        const next = clone(library)
        if (!next.groups.length) {
          next.groups.push({ id: uid('g_'), name: t('defaultGroup'), collapsed: false, items: [] })
        }
        const group =
          next.groups.find((entry) => entry.id === editing.groupId) || next.groups[0]
        if (!group) {
          notify('err', t('errNoGroup'))
          return
        }
        let index = 0
        if (editing.id) {
          const found = locateItem(next, editing.id)
          if (found) {
            index = found.group.id === group.id ? found.index : 0
            removeItem(next, editing.id)
          }
        }
        const id = editing.id || uid('p_')
        group.items.splice(index, 0, {
          id,
          title: (editing.title || '').trim() || firstLine(body),
          body,
          updatedAt: Date.now(),
        })
        commit(next)
        setEditing(null)
        setExpanded(id)
      }

      function submitGroupPrompt() {
        if (!groupPrompt) return
        const name = (groupPrompt.value || '').trim()
        if (!name) return
        const next = clone(library)
        if (groupPrompt.kind === 'rename') {
          const group = next.groups.find((entry) => entry.id === groupPrompt.groupId)
          if (group) group.name = name
        } else {
          next.groups.push({ id: uid('g_'), name, collapsed: false, items: [] })
        }
        commit(next)
        setGroupPrompt(null)
      }

      function deleteItem(itemId) {
        const next = clone(library)
        removeItem(next, itemId)
        delete next.lastValues[itemId]
        commit(next)
        setValues((previous) => {
          const copy = Object.assign({}, previous)
          delete copy[itemId]
          return copy
        })
        setConfirm(null)
        if (expanded === itemId) setExpanded(null)
      }

      function deleteGroup(groupId) {
        const next = clone(library)
        const removed = next.groups.find((group) => group.id === groupId)
        const goneIds = removed ? removed.items.map((item) => item.id) : []
        next.groups = next.groups.filter((group) => group.id !== groupId)
        for (const id of goneIds) delete next.lastValues[id]
        commit(next)
        if (goneIds.length) {
          setValues((previous) => {
            const copy = Object.assign({}, previous)
            for (const id of goneIds) delete copy[id]
            return copy
          })
        }
        if (expanded && goneIds.indexOf(expanded) >= 0) setExpanded(null)
        setConfirm(null)
      }

      function setValue(itemId, name, value) {
        setValues((previous) =>
          Object.assign({}, previous, {
            [itemId]: Object.assign({}, previous[itemId] || {}, { [name]: value }),
          }),
        )
      }

      function insert(item, text, filledValues) {
        if (busy) {
          notify('err', t('errBusy'))
          return
        }
        const result = insertIntoComposer(inputActions, text)
        if (result === 'ok') {
          if (filledValues) {
            commit({
              version: library.version,
              groups: library.groups,
              lastValues: Object.assign({}, library.lastValues, { [item.id]: filledValues }),
            })
          }
          notify('ok', t('inserted'))
          return
        }
        if (result === 'no-session') notify('err', t('errNoSession'))
        else if (result === 'blocked') notify('err', t('errBlocked'))
        else notify('err', t('errInsert'))
      }

      function renderGroupPrompt() {
        return h(
          'div',
          { className: 'dpl-inline' },
          h('input', {
            className: 'dpl-input',
            autoFocus: true,
            value: groupPrompt.value,
            placeholder: t('newGroup'),
            'aria-label': t('newGroup'),
            onChange: (event) =>
              setGroupPrompt(Object.assign({}, groupPrompt, { value: event.target.value })),
            onKeyDown: (event) => {
              if (event.key === 'Enter') submitGroupPrompt()
              if (event.key === 'Escape') setGroupPrompt(null)
            },
          }),
          h('button', { type: 'button', className: 'dpl-btn primary', onClick: submitGroupPrompt }, t('save')),
          h('button', { type: 'button', className: 'dpl-btn ghost', onClick: () => setGroupPrompt(null) }, t('cancel')),
        )
      }

      function renderCard(group, item) {
        const slots = scanSlots(item.body)
        const current = values[item.id] || library.lastValues[item.id] || {}
        const total = slots.length
        const mode = cardMode || (total >= 2 ? 'wizard' : 'form')
        const safeStep = total ? Math.min(step, total - 1) : 0
        const slot = total ? slots[safeStep] : null

        function stepCaption(index) {
          return t('blankN') + ' ' + (index + 1)
        }

        function commitInsert() {
          insert(item, assemble(item.body, slots, current), current)
        }

        function goNext() {
          if (safeStep < total - 1) setStep(safeStep + 1)
          else commitInsert()
        }

        function renderWizard() {
          if (!slot) return null
          const value = slotValue(current, slot)
          const repeated =
            !!slot.name && slots.some((other) => other.index < slot.index && other.name === slot.name)
          const before = item.body.slice(Math.max(0, slot.start - 24), slot.start)
          const after = item.body.slice(slot.end, slot.end + 24)
          return h(
            'div',
            { className: 'dpl-wizard' },
            h(
              'div',
              { className: 'dpl-progress' },
              h('span', null, safeStep + 1 + ' / ' + total),
              h(
                'div',
                { className: 'dpl-bar' },
                h('i', { style: { width: Math.round(((safeStep + 1) / total) * 100) + '%' } }),
              ),
            ),
            h('div', { className: 'dpl-question' }, slot.name || stepCaption(slot.index)),
            h('div', { className: 'dpl-context' }, before, h('span', { className: 'hl' }, slot.raw), after),
            h('input', {
              ref: stepInput,
              className: 'dpl-input',
              value: value === undefined ? '' : value,
              placeholder: t('fillHint'),
              'aria-label': slot.name || stepCaption(slot.index),
              onChange: (event) => setValue(item.id, slot.key, event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                goNext()
              },
            }),
            repeated ? h('div', { className: 'dpl-note' }, t('sharedValue')) : null,
            h(
              'div',
              { className: 'dpl-wnav' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-btn',
                  disabled: safeStep === 0,
                  onClick: () => setStep(safeStep - 1),
                },
                t('prev'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-btn ghost',
                  onClick: () => {
                    setValue(item.id, slot.key, '')
                    if (safeStep < total - 1) setStep(safeStep + 1)
                  },
                },
                t('skip'),
              ),
              h(
                'button',
                { type: 'button', className: 'dpl-btn primary', disabled: busy, onClick: goNext },
                safeStep < total - 1 ? t('next') : t('insertFilled'),
              ),
            ),
          )
        }

        function renderForm() {
          return h(
            'div',
            null,
            h('div', { className: 'dpl-preview' }, item.body),
            slots.map((entry) =>
              h(
                'div',
                { className: 'dpl-field', key: entry.key + ':' + entry.index },
                h('label', { className: 'dpl-label' }, entry.name || stepCaption(entry.index)),
                h('input', {
                  className: 'dpl-input dpl-fill',
                  value: slotValue(current, entry) === undefined ? '' : slotValue(current, entry),
                  placeholder: t('fillHint'),
                  'data-placeholder': entry.key,
                  'aria-label': entry.name || stepCaption(entry.index),
                  onChange: (event) => setValue(item.id, entry.key, event.target.value),
                  onKeyDown: (event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const card = event.currentTarget.closest
                      ? event.currentTarget.closest('.dpl-card')
                      : null
                    const fields = card
                      ? Array.prototype.slice.call(card.querySelectorAll('.dpl-fill'))
                      : []
                    const position = fields.indexOf(event.currentTarget)
                    if (fields[position + 1]) {
                      fields[position + 1].focus()
                      return
                    }
                    commitInsert()
                  },
                }),
              ),
            ),
          )
        }

        return h(
          'div',
          { className: 'dpl-card' },
          h(
            'div',
            { className: 'dpl-cardhead' },
            h('span', null, total ? total + ' ' + t('blanks') : t('noBlanks')),
            h('span', { style: { flex: 1 } }),
            total >= 2
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn ghost',
                    onClick: () => {
                      setCardMode(mode === 'wizard' ? 'form' : 'wizard')
                      setStep(0)
                    },
                  },
                  mode === 'wizard' ? t('showAll') : t('oneByOne'),
                )
              : null,
            h(
              'button',
              { type: 'button', className: 'dpl-btn ghost', onClick: () => startEdit(group, item) },
              t('edit'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn ghost',
                onClick: () => setConfirm({ kind: 'item', id: item.id }),
              },
              t('delete'),
            ),
          ),
          mode === 'wizard' ? renderWizard() : renderForm(),
          h(
            'div',
            { className: 'dpl-actions' },
            mode === 'form' && total
              ? h(
                  'button',
                  { type: 'button', className: 'dpl-btn primary', disabled: busy, onClick: commitInsert },
                  t('insertFilled'),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: mode === 'form' && total ? 'dpl-btn' : 'dpl-btn primary',
                disabled: busy,
                onClick: () => insert(item, item.body, current),
              },
              total ? t('insertRaw') : t('insert'),
            ),
          ),
          confirm && confirm.kind === 'item' && confirm.id === item.id
            ? h(
                'div',
                { className: 'dpl-confirm' },
                h('span', null, t('confirmDeleteItem')),
                h('button', { type: 'button', className: 'dpl-btn danger', onClick: () => deleteItem(item.id) }, t('delete')),
                h('button', { type: 'button', className: 'dpl-btn ghost', onClick: () => setConfirm(null) }, t('cancel')),
              )
            : null,
        )
      }

      function renderItem(group, item, showGroup) {
        const open = expanded === item.id
        return h(
          'div',
          { key: item.id },
          h(
            'button',
            {
              type: 'button',
              className: 'dpl-item' + (open ? ' active' : ''),
              onClick: () => setExpanded(open ? null : item.id),
              'aria-expanded': open,
            },
            h('div', { className: 'dpl-item-title' }, item.title || firstLine(item.body) || '—'),
            h('div', { className: 'dpl-item-sub' }, showGroup ? group.name : preview(item.body)),
          ),
          open ? renderCard(group, item) : null,
        )
      }

      function renderGroupMenu(group) {
        return h(
          'div',
          { className: 'dpl-menu' },
          h('button', { type: 'button', className: 'dpl-menu-item', onClick: () => startNew(group.id) }, t('newPrompt')),
          h(
            'button',
            {
              type: 'button',
              className: 'dpl-menu-item',
              onClick: () => {
                setGroupPrompt({ kind: 'rename', groupId: group.id, value: group.name })
                setGroupMenu(null)
              },
            },
            t('renameGroup'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dpl-menu-item danger',
              onClick: () => {
                setConfirm({ kind: 'group', id: group.id })
                setGroupMenu(null)
              },
            },
            t('deleteGroup'),
          ),
        )
      }

      function renderGroup(group) {
        const collapsed = group.collapsed
        return h(
          'section',
          { className: 'dpl-group', key: group.id },
          h(
            'div',
            { className: 'dpl-ghead' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-gtoggle',
                onClick: () => toggleGroup(group.id),
                'aria-expanded': !collapsed,
              },
              h('span', { className: 'dpl-caret' }, collapsed ? '▸' : '▾'),
              h('span', { className: 'dpl-gname' }, group.name),
              h('span', { className: 'dpl-count' }, String(group.items.length)),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-icon-btn',
                title: t('groupMenu'),
                'aria-label': t('groupMenu'),
                onClick: () => setGroupMenu(groupMenu === group.id ? null : group.id),
              },
              '⋯',
            ),
          ),
          groupMenu === group.id ? renderGroupMenu(group) : null,
          groupPrompt && groupPrompt.kind === 'rename' && groupPrompt.groupId === group.id
            ? renderGroupPrompt()
            : null,
          confirm && confirm.kind === 'group' && confirm.id === group.id
            ? h(
                'div',
                { className: 'dpl-confirm' },
                h('span', null, t('confirmDeleteGroup')),
                h('button', { type: 'button', className: 'dpl-btn danger', onClick: () => deleteGroup(group.id) }, t('delete')),
                h('button', { type: 'button', className: 'dpl-btn ghost', onClick: () => setConfirm(null) }, t('cancel')),
              )
            : null,
          collapsed
            ? null
            : h(
                'div',
                { className: 'dpl-items' },
                group.items.length
                  ? group.items.map((item) => renderItem(group, item, false))
                  : h('div', { className: 'dpl-group-empty' }, t('emptyGroup')),
              ),
        )
      }

      function renderEditor() {
        const draft = editing
        return h(
          'div',
          { className: 'dpl-card' },
          h(
            'div',
            { className: 'dpl-field' },
            h('label', { className: 'dpl-label' }, t('fieldTitle')),
            h('input', {
              className: 'dpl-input',
              value: draft.title,
              placeholder: firstLine(draft.body) || t('fieldTitle'),
              onChange: (event) => setEditing(Object.assign({}, draft, { title: event.target.value })),
            }),
          ),
          h(
            'div',
            { className: 'dpl-field' },
            h('label', { className: 'dpl-label' }, t('fieldGroup')),
            h(
              'select',
              {
                className: 'dpl-input',
                value: draft.groupId,
                onChange: (event) => setEditing(Object.assign({}, draft, { groupId: event.target.value })),
              },
              library.groups.length
                ? library.groups.map((group) => h('option', { key: group.id, value: group.id }, group.name))
                : h('option', { value: '' }, t('defaultGroup')),
            ),
          ),
          h(
            'div',
            { className: 'dpl-field' },
            h('label', { className: 'dpl-label' }, t('fieldBody')),
            h('textarea', {
              className: 'dpl-textarea',
              value: draft.body,
              onChange: (event) => setEditing(Object.assign({}, draft, { body: event.target.value })),
            }),
            h('div', { className: 'dpl-hint' }, t('placeholderHint')),
          ),
          h(
            'div',
            { className: 'dpl-actions' },
            h('button', { type: 'button', className: 'dpl-btn primary', onClick: saveEditing }, t('save')),
            h('button', { type: 'button', className: 'dpl-btn', onClick: () => setEditing(null) }, t('cancel')),
          ),
        )
      }

      function renderBody() {
        if (editing) return renderEditor()
        if (search) {
          if (!matches || !matches.length) {
            return h('div', { className: 'dpl-empty' }, h('div', { className: 'dpl-empty-title' }, t('noResults')))
          }
          return matches.map((entry) => renderItem(entry.group, entry.item, true))
        }
        if (!library.groups.length) {
          return h(
            'div',
            { className: 'dpl-empty' },
            h('div', { className: 'dpl-empty-title' }, t('emptyTitle')),
            h('div', { className: 'dpl-empty-hint' }, t('emptyHint')),
          )
        }
        return library.groups.map(renderGroup)
      }

      return h(
        'div',
        { className: 'dpl-root' },
        h(Styles, null),
        h(
          'div',
          { className: 'dpl-head' },
          h(
            'div',
            { className: 'dpl-headrow' },
            h('span', { className: 'dpl-title' }, t('tabTitle')),
            h('button', { type: 'button', className: 'dpl-btn primary', onClick: () => startNew(null) }, t('new')),
          ),
          h('input', {
            className: 'dpl-input',
            value: query,
            placeholder: t('search'),
            'aria-label': t('search'),
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        flash ? h('div', { className: 'dpl-toast' + (flash.kind === 'err' ? ' err' : '') }, flash.text) : null,
        inputActions ? null : h('div', { className: 'dpl-banner' }, t('noSession')),
        h(
          'div',
          { className: 'dpl-body' },
          renderBody(),
          !editing && !search && groupPrompt && groupPrompt.kind === 'new' ? renderGroupPrompt() : null,
          !editing && !search
            ? h(
                'div',
                { className: 'dpl-foot' },
                groupPrompt && groupPrompt.kind === 'new'
                  ? null
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: 'dpl-btn ghost wide',
                        onClick: () => setGroupPrompt({ kind: 'new', groupId: null, value: '' }),
                      },
                      '+ ' + t('newGroup'),
                    ),
              )
            : null,
        ),
      )
    }

    /* ------------------------------------------------------------- lifecycle */

    function apply(ctx) {
      ctxRef = ctx

      try {
        ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'prompt-library: zh dictionary')
        ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'prompt-library: en dictionary')
        const bound = ctx.locale.bind(NS)
        if (typeof bound === 'function') t = bound
      } catch (err) {
        console.error('[prompt-library] locale unavailable; falling back to raw keys', err)
      }

      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: DEF_ID,
            kind: TYPE_ID,
            title: () => t('tabTitle'),
            guide: [
              {
                id: TYPE_ID,
                order: 30,
                title: () => t('tabTitle'),
                description: () => t('guideHint'),
              },
            ],
          }),
        'prompt-library: tab type',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: DEF_ID }, PromptLibraryTab),
          ),
        'prompt-library: tab body',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('conversation.input.left', () =>
            ctx.slots.register(
              { name: 'conversation.input.left', id: DEF_ID, order: 40, label: () => t('open') },
              OpenButton,
            ),
          ),
        'prompt-library: composer trigger',
      )
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'],
      apply,
      /** Test seam: pure helpers, exercised by `npm test` without a browser. */
      __internals: { scanSlots, slotValue, assemble },
    }
  },
})
