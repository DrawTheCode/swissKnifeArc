type typeOfLink = 'redirect' | 'rare' | 'story' | 'author' | 'tag' | 'section' | 'video' | 'gallery' | 'file' | 'sitemap' | 'search'| 'wrong-url' | 'any'
type statusCheck = 'none' | 'ok' | 'manual' | 'failed' | 'process' | 'waiting-ok' | 'google' | 'date' | 'arcTime' | 'recent' | 'metro' | 'olderRedirect' | 'circulate' | 'findUrlWithRedirectTo' | 'searchByTitle'
type method = 'redirect' | 'overwrite' | 'resolver' | 'create' | 're-circulate' | 'clear' | 'search-google' | null

export interface filterOptions {
  httpStatus: number
  method: method | null = null
  type: typeOfLink
  status: statusCheck
}

export interface linkValues {
  url: string | null
  httpStatus: number | null
  typeOfUrl: typeOfLink | null
  outputType: string | null
  probableSolution: string|null
  solution: method[]|null
  status: statusCheck = 'none'
}

export interface redirectPublimetro {
  idArc: string
  urlWpFrom: string
  urlWpTo: string
  urlComposer: string
}

export interface identityUrl {
  siteId: string
  storyId: string | null
}

export interface modLinkValues extends linkValues {
  position: number
}

export interface arcSimple {
  url: string
  site: string
  id: string
}

export interface arcSimpleStory extends arcSimple {
  type: typeOfLink
  title: string
  isTitleByIteration: boolean = false
}

export interface arcReCirculate extends arcSimpleStory {
  method: method
}

export interface arcExposeStory extends arcSimple {
  composerUrl: string
}

export interface ortographyChecker {
  origin: string
  mod: string
}

export interface ortographyTitlePossibilities{
  origin: string
  result: string[]
}
