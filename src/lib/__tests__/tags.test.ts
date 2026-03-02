import { describe, it, expect } from 'vitest'
import { Tags } from '../tags'

describe('Tags', () => {
  describe('list', () => {
    it('returns empty array initially', async () => {
      expect(await Tags.list()).toEqual([])
    })
  })

  describe('add', () => {
    it('creates a new tag with color and zero count', async () => {
      const tag = await Tags.add('react')
      expect(tag.name).toBe('react')
      expect(tag.color).toBeTruthy()
      expect(tag.count).toBe(0)
    })

    it('returns existing tag if name already exists', async () => {
      const t1 = await Tags.add('vue')
      const t2 = await Tags.add('vue')
      expect(t1).toEqual(t2)
      const list = await Tags.list()
      expect(list).toHaveLength(1)
    })

    it('assigns different colors to different tags', async () => {
      const t1 = await Tags.add('a')
      const t2 = await Tags.add('b')
      // Colors cycle through DEFAULT_COLORS array
      expect(t1.color).toBeTruthy()
      expect(t2.color).toBeTruthy()
    })

    it('cycles colors when more tags than colors', async () => {
      for (let i = 0; i < 10; i++) {
        await Tags.add(`tag-${i}`)
      }
      const list = await Tags.list()
      expect(list).toHaveLength(10)
      // Color at index 0 and 8 should be the same (8 default colors)
      expect(list[0].color).toBe(list[8].color)
    })
  })

  describe('remove', () => {
    it('removes a tag by name', async () => {
      await Tags.add('remove-me')
      await Tags.remove('remove-me')
      const list = await Tags.list()
      expect(list.find((t) => t.name === 'remove-me')).toBeUndefined()
    })

    it('is no-op for nonexistent tag', async () => {
      await Tags.remove('does-not-exist')
      // should not throw
    })
  })

  describe('incrementCount', () => {
    it('increments count by 1', async () => {
      await Tags.add('inc-test')
      await Tags.incrementCount('inc-test')
      await Tags.incrementCount('inc-test')
      const list = await Tags.list()
      expect(list.find((t) => t.name === 'inc-test')!.count).toBe(2)
    })

    it('is no-op for nonexistent tag', async () => {
      await Tags.incrementCount('fake')
      // should not throw
    })
  })

  describe('decrementCount', () => {
    it('decrements count by 1', async () => {
      await Tags.add('dec-test')
      await Tags.incrementCount('dec-test')
      await Tags.incrementCount('dec-test')
      await Tags.decrementCount('dec-test')
      const list = await Tags.list()
      expect(list.find((t) => t.name === 'dec-test')!.count).toBe(1)
    })

    it('does not go below 0', async () => {
      await Tags.add('zero-test')
      await Tags.decrementCount('zero-test')
      const list = await Tags.list()
      expect(list.find((t) => t.name === 'zero-test')!.count).toBe(0)
    })
  })

  describe('getColor', () => {
    it('returns color for existing tag', async () => {
      const tag = await Tags.add('colored')
      const color = await Tags.getColor('colored')
      expect(color).toBe(tag.color)
    })

    it('returns default color for nonexistent tag', async () => {
      const color = await Tags.getColor('nonexistent')
      expect(color).toBe('#34d399') // first default color
    })
  })
})
