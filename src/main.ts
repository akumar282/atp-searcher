import axios from 'axios';
import { HTMLElement, parse as parseHTML } from 'node-html-parser'
import { stateAbbrv } from './constants'
import fs from 'fs'
import { menuItem } from './types';

const BASE_URL = 'https://www.allmenus.com'
const CITY_URL_LIST: string[] = []


async function getPage(endpoint: string): Promise<HTMLElement | number> {
  try {
    const data = await axios.get(endpoint, {
      headers: {
        'accept': 'application/ld+json',
        'cache-control': 'no-cache',
        'content-type': 'application/ld+json',
      },
    })
    const parsedData = parseHTML(data.data);
    return parsedData;
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}


async function fetchParsedCityUrls(state: string): Promise<string[]> {
  const endpoint = `https://www.allmenus.com/${state}/`
  const parsedData = await getPage(endpoint)
  if (parsedData === 404) {
    return []
  } else {
    const citiesList = (parsedData as HTMLElement)?.querySelectorAll('div[class="cities-column s-col-xs-12 s-col-sm-6 s-col-lg-3"]')
    if (citiesList) {
      for (let i = 0; i < 4; i++) {
        const cityLinks = citiesList[i].querySelectorAll('a')
        for (const link of cityLinks) {
          CITY_URL_LIST.push(BASE_URL + link.getAttribute('href')! + '-/')
        }
      }
    }
    return CITY_URL_LIST
  }
}


async function stateResturants(cityUrl: string): Promise<any> {
  try {
    const parsedData = await getPage(cityUrl);
    const restaurantList = (parsedData as HTMLElement)?.querySelector('ul[class="restaurant-list"]');
    const listObject = restaurantList?.querySelectorAll('h4[class="name"]');
    if (listObject) {
      for (const h4Elem of listObject) {
        await getMenuItems(BASE_URL + h4Elem.querySelector('a')?.getAttribute('href')!);
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function getMenuItems(menuUrl: string) {
  const parsedData = await getPage(menuUrl)
  const phoneNumber = (parsedData as HTMLElement)?.querySelector('div[class="phone"]')
  ?.querySelector('a')?.getAttribute('href')!.replace('tel:', '')
  const restName = (parsedData as HTMLElement)?.querySelector('div[class="s-col-lg-8 s-col-xs-12 restaurant-summary"]')
  ?.querySelector('h1')?.text!
  const address = (parsedData as HTMLElement)?.querySelector('ul[class="info-list"]')
  ?.querySelector('a[class="menu-address"]')?.text!
  const allItemCategory = (parsedData as HTMLElement)?.querySelectorAll('li[class="menu-category"]')
  for (const itemCategory of allItemCategory) {
    for (const item of itemCategory.querySelectorAll('li[class="menu-items"]')) {
      const menuItem: menuItem = {
        itemName: item.querySelector('span[class="item-title"]')?.text!,
        price: Number(item.querySelector('span[class="item-price"]')?.text!.replace('$', '')),
        description: item.querySelector('p[class="description"]')?.text!,
        category: itemCategory.querySelector('div[class="h4 category-name menu-section-title"]')?.text!,
        categoryDescription: itemCategory.querySelector('div[class="category-description"]')?.text!,
        restaurantPN: phoneNumber!,
        resutaurantName: restName!,
        address: address!,
        menuUrl: menuUrl
      }
      await writeToFile(menuItem)
    }
  }
}


async function writeToFile(menuItem: menuItem): Promise<void> {
  const jsonData = JSON.stringify(menuItem, null, 2);

  try {
    fs.appendFileSync('menuItems.json', jsonData + ',\n')
  } catch (error) {
    console.error('An error occurred while appending to menuItems.json:', error);
  }
}

async function removeTrailingComma(): Promise<void> {
  const menuItemsFilePath = 'menuItems.json'

  try {
    if (fs.existsSync(menuItemsFilePath)) {
      let fileData = fs.readFileSync(menuItemsFilePath, 'utf8')
      fileData = fileData.replace(/,\s*([\]}])/g, '\n$1')

      fs.writeFileSync(menuItemsFilePath, fileData, { flag: 'w' })
    } else {
      console.log('menuItems.json file does not exist.')
    }
  } catch (error) {
    console.error('An error occurred while removing trailing comma:', error)
  }
}

fs.writeFileSync('menuItems.json', '[\n')
for (const state of stateAbbrv) {
  await fetchParsedCityUrls(state);
}
for (const url of CITY_URL_LIST) {
  await stateResturants(url)
}
fs.appendFileSync('menuItems.json', ']')
await removeTrailingComma()
console.log('Done!')
