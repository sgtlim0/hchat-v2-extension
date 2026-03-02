import { describe, it, expect, beforeEach } from 'vitest'
import { Folders } from '../folders'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

describe('Folders', () => {
  it('starts with empty list', async () => {
    const folders = await Folders.list()
    expect(folders).toEqual([])
  })

  it('creates a folder', async () => {
    const folder = await Folders.create('Work')
    expect(folder.name).toBe('Work')
    expect(folder.id).toBeTruthy()
    expect(folder.color).toBeTruthy()

    const list = await Folders.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Work')
  })

  it('creates multiple folders with different colors', async () => {
    await Folders.create('Work')
    await Folders.create('Personal')
    await Folders.create('Projects')

    const list = await Folders.list()
    expect(list).toHaveLength(3)
    // Colors should cycle through defaults
    const colors = list.map((f) => f.color)
    expect(colors[0]).not.toBe(colors[1])
  })

  it('renames a folder', async () => {
    const folder = await Folders.create('Old Name')
    await Folders.rename(folder.id, 'New Name')

    const list = await Folders.list()
    expect(list[0].name).toBe('New Name')
  })

  it('deletes a folder', async () => {
    const f1 = await Folders.create('Keep')
    const f2 = await Folders.create('Delete')
    await Folders.delete(f2.id)

    const list = await Folders.list()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(f1.id)
  })

  it('trims folder names', async () => {
    const folder = await Folders.create('  Spaced  ')
    expect(folder.name).toBe('Spaced')
  })

  it('uses custom color when provided', async () => {
    const folder = await Folders.create('Custom', '#ff0000')
    expect(folder.color).toBe('#ff0000')
  })
})
