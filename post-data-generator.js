// Copyright 2020 afuzzyllama

const { readdirSync, readFileSync, writeFileSync } = require('fs')

const getDirectories = source =>
    readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

// Compare function for post dates, latest date first
function compare(a, b) {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);

    let comparison = 0;
    if(aDate > bDate) {
        comparison = -1;
    }
    else if(aDate < bDate) {
        comparison = 1;
    }
    return comparison;
}

var showdown  = require("./showdown-1.9.1.js");
var converter = new showdown.Converter({metadata: true});

var contentDirs = getDirectories(`${__dirname}/content`);

// Process meta data
var outMetadata = [];
for(let i = 0; i < contentDirs.length; i++) {

    if(contentDirs[i] == "posts" || contentDirs[i].startsWith(".") || contentDirs[i] == "l3a")
    {
        continue;
    }

    var content = readFileSync(`${__dirname}/content/${contentDirs[i]}/content.md`, 'utf8');
    converter.makeHtml(content);

    var metadata = converter.getMetadata();

    // Ignore drafts
    if("draft" in metadata) {
        if(metadata.draft == "true") {
            continue;
        }
    }
    
    // Ignore hidden content
    if("hide" in metadata) {
        if(metadata.hide == "true") {
            continue;
        }
    }

    var requiredMetadata = {};
    if("title" in metadata) {
        requiredMetadata.title = metadata.title;
    }

    if("date_updated" in metadata) {
        requiredMetadata.date = metadata.date_updated;
    }
    else if("date_created" in metadata) {
        requiredMetadata.date = metadata.date_created;
    }

    if("date" in requiredMetadata) {
        var date = new Date(requiredMetadata.date)
        requiredMetadata.date = `${date.getFullYear()}/${(new String(date.getMonth() + 1)).padStart(2, "0")}/${(new String(date.getDate())).padStart(2, "0")}`
    }

    if("category" in metadata) {
        requiredMetadata.category = metadata.category;
    }

    if("short_link" in metadata) {
        requiredMetadata.short_link = metadata.short_link;
    }

    if("image" in metadata) {
        requiredMetadata.image = metadata.image;
    }

    if("title" in requiredMetadata) {
        requiredMetadata.directory = contentDirs[i];
        outMetadata.push(requiredMetadata);
    }
}

// Generate RSS and site map items
var rssItems = [];
var siteMapItems = [];
for(let i in outMetadata.sort(compare)) {

    var url = `https://a.llama.codes/${outMetadata[i].directory}`;

    var rssItem = `
        <item>
            <title>${outMetadata[i].title}</title>
            <description><a href="${url}">read more</a></description>
            <pubDate>${outMetadata[i].date}</pubDate>
            <category>${outMetadata[i].category}</category>
        </item>`;

    rssItems.push(rssItem);

    var siteMapItem = `
    <url>
        <loc>${url}</loc>
        <lastmod>${outMetadata[i].date}</lastmod>
    </url>`;

    siteMapItems.push(siteMapItem);

}

var date = new Date();
var rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
    <channel>
        <title>a llama codes</title>
        <description>Software blog of afuzzyllama</description>
        <link>https://a.llama.codes/</link>
        <lastBuildDate>${date.getFullYear()}-${(new String(date.getMonth() + 1)).padStart(2, "0")}-${(new String(date.getDate())).padStart(2, "0")}</lastBuildDate>
        <language>en</language>${rssItems.join("\r")}
    </channel>
</rss>
`;

var siteMap = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${siteMapItems.join("\r")}
</urlset>
`;

// Generate short urls
var shortLinks = {};
for(let i in outMetadata) {
    if(!("short_link" in outMetadata[i])) {
        continue;
    }

    if(!(outMetadata[i].short_link in shortLinks)) {
        shortLinks[outMetadata[i].short_link] = 0;
    }
    shortLinks[outMetadata[i].short_link]++;

    if(shortLinks[outMetadata[i].short_link] > 1) {
        throw new Error("Short link: " + outMetadata[i].short_link + " already exists");
    }

    writeFileSync(`${__dirname}/l3a/${outMetadata[i].short_link}.json`, JSON.stringify(outMetadata[i]));
    
}

 writeFileSync(`${__dirname}/posts/metadata.json`, JSON.stringify(outMetadata));
 writeFileSync(`${__dirname}/rss.xml`, rss);
 writeFileSync(`${__dirname}/sitemap.xml`, siteMap);

 console.log("success");



