const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');
const when = require('when');
const _ = require('lodash');

const BASE_URL = 'https://en.wikipedia.org/wiki/ISO_3166-2';
const RESULT_FILE_NAME = 'ISO_3166_2.json';

const cleanUp = (str) => str
  .replace(/\(.*\)/g, '')
  .replace(/\[.*\]/g, '')
  .replace(/\n/g, '')
  .trim();

async function main() {
  const codesMap = {};

  const rootHtml = await axios({
    url: BASE_URL
  }).then(res => res.data);

  const $ = cheerio.load(rootHtml, { decodeEntities: true });

  const rootCodes = $(`table.wikitable:eq(0) > tbody > tr > td:first-child`).toArray().map(item => {
    return $(item).text();
  });

  async function getISO3166SecondLevelData(i) {
    var code = rootCodes[i];
    const url = `${BASE_URL}:${code}`;

    const html = await axios({
      url
    }).then(res => res.data);
    const $ = cheerio.load(html, { decodeEntities: true });

    const firstColumnTitle = $(`table.wikitable:eq(0) > tbody > tr > th:first-child`).toArray().map(item => {
      return cleanUp($(item).text());
    });

    if (firstColumnTitle.length && !firstColumnTitle[0].match(/Code/)) { 
      return;
    }

    const codes = $(`table.wikitable:eq(0) > tbody > tr > td:first-child`).toArray().map(item => {
      return cleanUp($(item).text());
    });

    var names = $(`table.wikitable:eq(0) > tbody > tr > td:nth-child(2)`).toArray().map(item => {
      return cleanUp($(item).text());
    });

    names = _.map(names, (name) => {
      if (name.indexOf(',') >= 0) {
        var options = name.split(',');
        return options[0].trim();
      } else {
        return name;
      }
    });

    const localCodesMap = {};
    
    codes.forEach((code, i) => {
      _.assign(localCodesMap, {[code] : names[i]});
    });

    _.assign(codesMap, {[code] : localCodesMap});
  }

  return when
    .iterate(
      (index) => index + 1,
      (index) => index === rootCodes.length,
      getISO3166SecondLevelData,
      0,
    )
    .then(async (_) => {
      return codesMap;
    });
}

main().then(res => {
  fs.writeFileSync(RESULT_FILE_NAME, JSON.stringify(res));
  console.log('DONE');
});