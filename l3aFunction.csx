#r "Newtonsoft.Json"

using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json;


public class ShortUrlMetadata {
    public string title;
    public string date;
    public string category;
    public string short_link;
    public string directory;
    public string image;
}

public static HttpResponseMessage Run(HttpRequest req, 
                                            string short_link,
                                            ILogger log)
{
    log.LogInformation($"Request made for: {short_link}");

    var jsonUrl = $"https://a.llama.codes/l3a/{short_link}.json";
    string json;
    try 
    {
        json = (new WebClient()).DownloadString(jsonUrl);
    }
    catch(Exception)
    {
        var responseNotFound = new HttpResponseMessage(HttpStatusCode.NotFound);
        responseNotFound.Content = new StringContent($"Short link {short_link} cannot be found");
        return responseNotFound;
    }

    ShortUrlMetadata metadata;
    try 
    {
        metadata = JsonConvert.DeserializeObject<ShortUrlMetadata>(json);
    }
    catch(Exception)
    {
        var responseBadRequest = new HttpResponseMessage(HttpStatusCode.BadRequest);
        responseBadRequest.Content = new StringContent($"Short link {short_link} cannot be processed");
        return responseBadRequest;
    }
    
    if(metadata.directory == null ||  metadata.directory == "") {
        var responseBadRequest = new HttpResponseMessage(HttpStatusCode.BadRequest);
        responseBadRequest.Content = new StringContent($"Short link {short_link} cannot be resolved");
        return responseBadRequest;
    }
    
    var response = new HttpResponseMessage(HttpStatusCode.OK);
    var url = $"https://a.llama.codes/{metadata.directory}";
    var imgUrl = string.IsNullOrEmpty(metadata.image) ? "https://allamacodes.azureedge.net/img/llamaface.png" : $"https://allamacodes.azureedge.net/content/{metadata.directory}/{metadata.image}";

    response.Content = new StringContent($@"<html>
    <head>
        <meta content=""text/html; charset=UTF-8"" name=""Content-Type"" />
        <meta name=""twitter:card"" content=""summary"" />
        <meta name=""twitter:site"" content=""@afuzzyllama"" />
        <meta name=""twitter:creator"" content=""@afuzzyllama"" />
        <meta name=""twitter:title"" content=""{metadata.title}"" />
        <meta name=""twitter:description"" content=""Read on a.llama.codes!"" />
        <meta name=""twitter:image"" content=""{imgUrl}""/>
        <meta name=""og:url"" content=""{url}"" />        
        <meta http-equiv=""refresh"" content=""0;url={url}"" />
    </head>
</html>");

    response.Content.Headers.ContentType = new MediaTypeHeaderValue("text/html");
    return response;
}

