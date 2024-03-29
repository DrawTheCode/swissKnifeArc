import { AxiosResponse } from 'axios'
import { SitesList } from '../types/sites'
import sitesData from '../config/static_data/blocks.json'
import { arcExposeStory, arcSimpleStory, typeOfLink } from '../types/urlToVerify'
import { ratioElementsOptions, searchInArcItemOptions } from '../types/config'
import { ratioWords } from '../utils/genericUtils'
import { getAsyncWebGrammarly, getAListOfPossiblesTitles } from '../subscribers/grammarly'
import { getDataFromArc } from '../models/getDataFromArc'

export const iterativeSearchQuery = async (queryString: string): Promise <AxiosResponse|null> => {
  for (let x = 0; x < 10; x++) {
    try {
      const item = await getDataFromArc(queryString)
        .then(function (response) {
          return response
        })
      if(item.data!==null){
        return item
      }
    } catch (_error) {
      return null
    }
  }
  return null
}

const searchStoryByAny = async (queryString:string,siteId:string,from:number=0):Promise <any[]> => {
  let result: any = await iterativeSearchQuery(`${queryString}&from=${from}&size=100`)
  let resultList = result?.data?.content_elements || [] 
  if(result?.data?.next!==undefined){
    const checkNextSearch = await searchStoryByAny(queryString,siteId,result.data.next)
    resultList.concat(checkNextSearch)
  }
  return resultList
}

export const getArcExposeStorySearch =async (queryString:string,siteId:string):Promise <arcExposeStory[]> => {
  const searchResults = await searchStoryByAny(queryString,siteId)
  const resultList: arcExposeStory[] = []
  if ( searchResults.length > 0 ) {
    for (const story of searchResults) {
      const tempStory : arcExposeStory  = {
        url:story.websites[siteId].website_url??'notFound',
        site:siteId,
        id:story._id??'none',
        composerUrl:story._id!==undefined?`https://metroworldnews.arcpublishing.com/composer/edit/${story._id}`:'none'
      }
      resultList.push(tempStory)
    }
  }
  return resultList
}

const searchInArc = async (siteId: string, searchQuery: string): Promise<arcSimpleStory[]|null> => {
  const returnValues = '_id,website_url,websites,canonical_url,headlines.basic,type'
  const queryString = `/content/v4/search/published?website=${siteId}&q=${searchQuery}&_sourceInclude=${returnValues}`
  const result: any = await searchStoryByAny(queryString,siteId)
  if (result.length>0) {
    const resultQueryList = result?.data?.content_elements || undefined
    const resultList: arcSimpleStory[] = []
    const isSearchByTitle = searchQuery.match(/headlines.basic:/) !== null
    if (resultQueryList !== undefined && resultQueryList.length > 0) {
      for (const story of resultQueryList) {
        const tempStory = restructureAarcSimpleStory(siteId, story, isSearchByTitle)
        resultList.push(tempStory)
      }
      return resultList
    }
  }
  return null
}

const reverseSearch = async (siteId: string, search: string, compareOrder: string[]): Promise <any|null> => {
  const searchQuery = `canonical_url:*${search}*`
  if (siteId === compareOrder[0]) {
    const find = searchInArc(siteId, searchQuery)
    if (await find === null) {
      return await searchInArc(compareOrder[1], searchQuery)
    }
    return await find
  }
  return null
}

const searchByTitle = async (siteId: string, element: arcSimpleStory): Promise<arcSimpleStory|false> => {
  // const title = getAsyncWebGrammarly(element.title.replace(/:/g, '\\:').replace(/"/g, '\\"'))
  let title: string = element.title
  title = title.replace(/[:“”#\\]/g, '')
  const searchQuery = `headlines.basic:"${title}"+AND+type:"story"`
  // console.log('searchQuery', searchQuery)
  const data: any = await searchInArc(siteId, searchQuery)
  if (data !== null) {
    const result: any = restructureAarcSimpleStory(siteId, data.content_elements[0])
    return result
  }
  return false
}

const restructureAarcSimpleStory = (siteId: string, searchResult: any, searchByTitle: boolean = false): arcSimpleStory => {
  let titleFromInput = 'No title, because is a redirect'
  if (searchResult._id.match(/_redirect_/) === null &&
     searchResult?.headlines?.basic !== undefined) {
    titleFromInput = searchResult.headlines.basic
  }
  const currentUrl: arcSimpleStory = {
    url: searchResult.website_url ?? searchResult.canonical_url ?? 'NOT DEFINED URL',
    site: siteId,
    id: searchResult._id,
    type: searchResult.type as typeOfLink,
    title: titleFromInput,
    isTitleByIteration: searchByTitle
  }
  return currentUrl
}

const comparativeResult = (resultList: any, config: ratioElementsOptions, ratio: number = 0.8): [number, arcSimpleStory]|false => {
  let returnValue: [number, arcSimpleStory]|false = false
  if (resultList.content_elements !== undefined) {
    for (const element of resultList.content_elements) {
      if (element.canonical_url !== undefined) {
        const ratioValue = ratioWords(element.canonical_url, config)
        // console.log('ratioValue', ratioValue)
        if (returnValue === false && ratioValue >= ratio) {
          const currentUrl = restructureAarcSimpleStory(config.siteId, element)
          returnValue = [ratioValue, currentUrl]
        }
        if (returnValue !== false && ratioValue > returnValue[0]) {
          const currentUrl = restructureAarcSimpleStory(config.siteId, element)
          returnValue = [ratioValue, currentUrl]
        }
      }
    }
  }
  return returnValue
}

const lookingForASite = async (searchConfig: searchInArcItemOptions): Promise <arcSimpleStory|false> => {
  // console.log(`\nSearch in sites bucle ===> ${searchConfig.siteId}.....${searchConfig.search}`)
  const mainSiteSearch: arcSimpleStory[] | null = await searchInArc(searchConfig.siteId, searchConfig.search)
  if (mainSiteSearch !== null && mainSiteSearch.length > 0) {
    const elements = mainSiteSearch.length
    // console.log(mainSiteSearch)
    if (elements === 1) {
      return mainSiteSearch[0]
    } else {
      const config: ratioElementsOptions = {
        type: searchConfig.type,
        siteId: searchConfig.siteId,
        valueToSearch: searchConfig.search
      }
      const checkingItem = comparativeResult(mainSiteSearch, config)
      if ((checkingItem !== false && checkingItem.length > 0) || (checkingItem !== false && searchConfig.search.match('headlines.basic') !== null)) {
        return checkingItem[1]
      }
    }
  }
  return false
}

const bucleSeachByTitleInSitesList = async (siteId: string, search: arcSimpleStory): Promise<arcSimpleStory|false> => {
  const allSites: SitesList = sitesData as SitesList
  const idListSites = Object.keys(allSites)
  let find: arcSimpleStory | false = false
  for (const localIdSite of idListSites) {
    if (localIdSite !== 'mwnbrasil' && localIdSite !== 'novamulher' && localIdSite !== siteId) {
      // const title = getAsyncWebGrammarly(search.title.replace(/:/g, '\\:').replace(/"/g, '\\"'))
      const title = getAsyncWebGrammarly(search.title)
      search.title = title.mod
      find = await searchByTitle(localIdSite, search)
      if (await find !== false) {
        return find
      }
    }
  }
  return find
}

const bucleSeachInSitesList = async (siteId: string, search: string, currentPriority: typeOfLink|false = false): Promise<arcSimpleStory|false> => {
  const allSites: SitesList = sitesData as SitesList
  const idListSites = Object.keys(allSites)
  let find: arcSimpleStory | false = false
  for (const localIdSite of idListSites) {
    // console.log(`Buscando en el Sitio: ${localIdSite}`)
    if (localIdSite !== 'mwnbrasil' && localIdSite !== 'novamulher' && localIdSite !== siteId) {
      const searchQuery = `canonical_url:*${search}*`
      const searchConfig: searchInArcItemOptions = {
        siteId: localIdSite,
        search: searchQuery,
        type: 'url',
        priority: currentPriority
      }
      find = await lookingForASite(searchConfig)
      // console.log('\nCheck In Site=========>\n', await find, '\n<=========\n')
      if (await find !== false) {
        return find
      }
    }
  }
  return find
}

export const searchInBucleArc = async (siteId: string, search: string, currentPriority: typeOfLink|false = false): Promise <arcSimpleStory|false> => {
  let find: arcSimpleStory|false = false
  if (siteId === 'mwnbrasil' || siteId === 'novamulher') {
    const compareList = siteId === 'mwnbrasil' ? ['mwnbrasil', 'novamulher'] : ['novamulher', 'mwnbrasil']
    find = await reverseSearch(siteId, search, compareList)
  } else {
    const searchQuery = `canonical_url:*${search}*`
    const searchConfig: searchInArcItemOptions = {
      siteId: siteId,
      search: searchQuery,
      type: 'url',
      priority: currentPriority
    }
    find = await lookingForASite(searchConfig)
    if (find === false) {
      find = await bucleSeachInSitesList(siteId, search, currentPriority)
    }
  }
  if (find !== false && currentPriority === false && (find?.type === 'gallery' || find?.type === 'video' || find.site !== siteId)) {
    const checkByTitle = await searchByTitle(siteId, find)
    if (checkByTitle !== false) {
      return checkByTitle
    } else {
      const returnValue = await bucleSeachByTitleInSitesList(siteId, find)
      return returnValue
    }
  }
  if (find === false) {
    const title = search.replace(/-/g, ' ')
    const generaTitulos = getAListOfPossiblesTitles(title)
    // console.log('\nStart search by all posibilities titles ')
    for (let x = 0; x < generaTitulos.result.length; x++) {
      const titulo: string = generaTitulos.result[x]
      const input = {
        headlines: { basic: titulo },
        canonical_url: 'no url',
        site: siteId,
        _id: 'no existe',
        type: 'story'
      }
      const element = restructureAarcSimpleStory(siteId, input)
      // process.stdout.write(`\r\nSearch by Title: ==>${titulo} ${x}/${generaTitulos.result.length}`)
      find = await searchByTitle(siteId, element)
      if (find !== false) {
        find.isTitleByIteration = true
        // process.stdout.write('\r')
        return find
      }
    }
    // process.stdout.write('\r')
  }
  return find
}
