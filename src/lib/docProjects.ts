// lib/docProjects.ts — Document project CRUD + version management

import { Storage } from './storage'
import type { DocType, DocSection } from './docGenerator'

const INDEX_KEY = 'hchat:doc-projects'
const PROJECT_PREFIX = 'hchat:doc-project:'
const MAX_VERSIONS = 10

export interface DocProjectVersion {
  id: string
  markdown: string
  sections: DocSection[]
  createdAt: number
}

export interface DocProject {
  id: string
  title: string
  type: DocType
  topic: string
  context: string
  outline: string[]
  sections: DocSection[]
  markdown: string
  versions: DocProjectVersion[]
  createdAt: number
  updatedAt: number
}

export interface DocProjectIndex {
  id: string
  title: string
  type: DocType
  updatedAt: number
}

function generateId(): string {
  return `dp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function generateVersionId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

async function getIndex(): Promise<DocProjectIndex[]> {
  return (await Storage.get<DocProjectIndex[]>(INDEX_KEY)) ?? []
}

async function saveIndex(index: DocProjectIndex[]): Promise<void> {
  await Storage.set(INDEX_KEY, index)
}

export const DocProjects = {
  /** List all project summaries */
  async list(): Promise<DocProjectIndex[]> {
    const index = await getIndex()
    return index.sort((a, b) => b.updatedAt - a.updatedAt)
  },

  /** Get a single project by ID */
  async get(id: string): Promise<DocProject | null> {
    return Storage.get<DocProject>(`${PROJECT_PREFIX}${id}`)
  },

  /** Create a new project */
  async create(data: {
    title: string
    type: DocType
    topic: string
    context: string
    outline: string[]
    sections: DocSection[]
    markdown: string
  }): Promise<DocProject> {
    const now = Date.now()
    const project: DocProject = {
      id: generateId(),
      title: data.title,
      type: data.type,
      topic: data.topic,
      context: data.context,
      outline: data.outline,
      sections: data.sections,
      markdown: data.markdown,
      versions: [],
      createdAt: now,
      updatedAt: now,
    }

    await Storage.set(`${PROJECT_PREFIX}${project.id}`, project)

    const index = await getIndex()
    const newIndex = [
      ...index,
      { id: project.id, title: project.title, type: project.type, updatedAt: now },
    ]
    await saveIndex(newIndex)

    return project
  },

  /** Update an existing project */
  async update(
    id: string,
    data: Partial<Pick<DocProject, 'title' | 'topic' | 'context' | 'outline' | 'sections' | 'markdown'>>,
  ): Promise<DocProject | null> {
    const project = await Storage.get<DocProject>(`${PROJECT_PREFIX}${id}`)
    if (!project) return null

    const updated: DocProject = {
      ...project,
      ...data,
      updatedAt: Date.now(),
    }

    await Storage.set(`${PROJECT_PREFIX}${id}`, updated)

    const index = await getIndex()
    const newIndex = index.map((item) =>
      item.id === id
        ? { ...item, title: updated.title, updatedAt: updated.updatedAt }
        : item,
    )
    await saveIndex(newIndex)

    return updated
  },

  /** Delete a project */
  async delete(id: string): Promise<boolean> {
    const project = await Storage.get<DocProject>(`${PROJECT_PREFIX}${id}`)
    if (!project) return false

    await Storage.remove(`${PROJECT_PREFIX}${id}`)

    const index = await getIndex()
    const newIndex = index.filter((item) => item.id !== id)
    await saveIndex(newIndex)

    return true
  },

  /** Save current state as a version snapshot */
  async saveVersion(id: string): Promise<DocProjectVersion | null> {
    const project = await Storage.get<DocProject>(`${PROJECT_PREFIX}${id}`)
    if (!project) return null

    const version: DocProjectVersion = {
      id: generateVersionId(),
      markdown: project.markdown,
      sections: [...project.sections],
      createdAt: Date.now(),
    }

    // FIFO: keep only last MAX_VERSIONS
    const versions = [...project.versions, version]
    const trimmed = versions.length > MAX_VERSIONS
      ? versions.slice(versions.length - MAX_VERSIONS)
      : versions

    const updated: DocProject = {
      ...project,
      versions: trimmed,
      updatedAt: Date.now(),
    }

    await Storage.set(`${PROJECT_PREFIX}${id}`, updated)

    // Update index timestamp
    const index = await getIndex()
    const newIndex = index.map((item) =>
      item.id === id ? { ...item, updatedAt: updated.updatedAt } : item,
    )
    await saveIndex(newIndex)

    return version
  },

  /** Get all versions of a project */
  async getVersions(id: string): Promise<DocProjectVersion[]> {
    const project = await Storage.get<DocProject>(`${PROJECT_PREFIX}${id}`)
    if (!project) return []
    return project.versions
  },

  /** Restore a project from a specific version */
  async restoreVersion(projectId: string, versionId: string): Promise<DocProject | null> {
    const project = await Storage.get<DocProject>(`${PROJECT_PREFIX}${projectId}`)
    if (!project) return null

    const version = project.versions.find((v) => v.id === versionId)
    if (!version) return null

    const restored: DocProject = {
      ...project,
      markdown: version.markdown,
      sections: version.sections,
      updatedAt: Date.now(),
    }

    await Storage.set(`${PROJECT_PREFIX}${projectId}`, restored)

    const index = await getIndex()
    const newIndex = index.map((item) =>
      item.id === projectId ? { ...item, updatedAt: restored.updatedAt } : item,
    )
    await saveIndex(newIndex)

    return restored
  },
}
