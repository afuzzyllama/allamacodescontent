---
title: NuGet and Maintaining Unity libraries
date_created: 2016/07/23
category: Unity
short_link: NGaMUl
image: nuget.png
---

## Motivation

When creating libraries for Unity3D, I wanted a simple way to maintain packages that were built automatically from a continuous integration server.  After looking at different ways to accomplish this, the following is the workflow I came up with to manage my Unity3D libraries.  This article assumes reader has basic knowledge of creating and working with NuGet packages.

## Setting Up Nuspec Files 

Initially when I started using NuGet with my Unity3D projects, I wanted to have one package for each library.  It turned out to be simpler to have a NuGet package for Unity3D project libraries and a NuGet package for Unity3D projects.

### Unity3D Project Library 

Working with project libraries just follow the [Nuspec Reference](https://docs.nuget.org/create/nuspec-reference) at the official site. The only thing to point out is that when adding a library, be sure that the `target` is `lib\net35`.  Hopefully in the future, Unity3D will target a higher framework, but for we are stuck targeting the 3.5 framework.

### Unity3D Project 

#### Example Nuspec

Here is the nuspec file that I use for my [Procedural Voxel Mesh](https://github.com/PixelsForGlory/ProceduralVoxelMesh):

{data-language=xml}
```
<?xml version="1.0"?>
<package>
  <metadata>
    <id>PixelsForGlory.Unity3D.ProceduralVoxelMesh</id>
    <version>0.0.0</version>
    <authors>afuzzyllama</authors>
    <owners>afuzzyllama</owners>
    <licenseUrl>
      https://github.com/PixelsForGlory/ProceduralVoxelMesh/blob/master/LICENSE
    </licenseUrl>
    <projectUrl>https://github.com/PixelsForGlory/ProceduralVoxelMesh/</projectUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <description>Library to create procedural voxel meshes in Unity3D.</description>
    <copyright>Copyright 2016</copyright>
    <tags>Unity3D Procedural Mesh</tags>
  </metadata>
  <files>
    <file 
      src="ProceduralVoxelMesh\bin\Release\ProceduralVoxelMesh.dll" 
      target="content\Assets\Plugins\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="ProceduralVoxelMesh\bin\Release\ProceduralVoxelMesh.pdb" 
      target="content\Assets\Plugins\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="ProceduralVoxelMeshEditor\bin\Release\ProceduralVoxelMeshEditor.dll" target="content\Assets\Plugins\Editor\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="ProceduralVoxelMeshEditor\bin\Release\ProceduralVoxelMeshEditor.pdb" target="content\Assets\Plugins\Editor\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="Resources\AlphaMap.png" 
      target="content\Assets\Resources\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="Resources\ColorVoxelMaterial.mat" 
      target="content\Assets\Resources\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="Resources\ColorVoxelSurfaceShader.shader"
      target="content\Assets\Resources\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="Resources\TextureVoxelMaterial.mat"
      target="content\Assets\Resources\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="Resources\TextureVoxelSurfaceShader.shader" 
      target="content\Assets\Resources\PixelsForGlory\ProceduralVoxelMesh" />
    <file 
      src="NuGetTools\Uninstall.ps1" 
      target="tools\PixelsForGlory\ProceduralVoxelMesh\" />
  </files>
</package>
```

Below I'll be explaining parts of my configuration.

Just to quickly point out, the version 0.0.0 gets replaced every time I do a build.

### Issues during package creation ###

Installing libraries into the Unity3D project is different from installing in a project library since we cannot take advantage of the library target.  Unity3D automatically generates references based on dlls placed in [special directories](https://docs.unity3d.com/Manual/SpecialFolders.html) and because of this we need to add dlls as content files.  This will trigger a warning in NuGet when adding dlls in this way:

{data-language=console}
```
WARNING: 1 issue(s) found with package 'ExampleNugetPackage'.
Issue: Assembly outside lib folder.
Description: The assembly 'content\Assets\Plugins\Example.dll' is not inside the 'lib' folder and hence it won't be added as reference when the package is installed into a project.
Solution: Move it into the 'lib' folder if it should be referenced.
```

Until I find another solution, I am ignoring this warning for now.

As shown above, instead of using the `lib\` target we can use the `content\` target for both dlls and other files needed.  I also install textures, shaders, and materials for the Procedural Voxel Mesh library for a simple install process.

### Issues during package update/uninstall ###

I found two issues that occur when using NuGet to manage packages inside of Unity3D projects.

1. NuGet tries to be very courteous when adding and removing files from your project.  This means if folders still contain files when NuGet tries to remove them it will skip over removing them.  If you haven't guessed the issue, when using [meta files for extend version control support](https://docs.unity3d.com/Manual/ExternalVersionControlSystemSupport.html) every file and folder has an a meta file associated with it.  I found that after installing a package for the first time, every subsequent update would require me to manually remove all of a package's files to work as intended.  Setting a system up like this in the first place is to handle all of this, I came up with the following uninstall script that I use in my Unity3D NuGet packages to remove all files and references that the package manages:

{data-language=powershell}
```
param($installPath, $toolsPath, $package, $project)

$baseDir = (Get-Item $project.FullName).DirectoryName
$assembly = ""
Foreach ($file in $package.GetFiles())
{
    # file paths to all content files and remove them from the directory and the project
    $pathParts = $file.Path.Split("\\")
    if($pathParts[0] -ne "content")
    {
        continue
    }

    $assembly = $pathParts[($pathParts.Length-1)].Split(".")
    $assembly = $assembly[0]

    $pathParts = $pathParts[1..($pathParts.Length - 1)]

    $path = $pathParts -join "\" | Out-String
    $path = $baseDir + "\" + $path
    $path = $path.Replace("`r", "")
    $path = $path.Replace("`n", "")

    Remove-Item "$path*"
}
$project.Object.References | Where-Object { $_.Name -eq $assembly } 
                           | ForEach-Object { $_.Remove() }
```

I tried having this script remove meta files as well, but for some reason those files cannot be removed while Unity3D is running.  So when uninstalling a package, any folders associated with a package will have to be removed manually.

### Benefits of using NuGet packages ###

After setting up a workflow like this and installing a few packages into a project, you don't need to worry about checking in shared libraries and assets between projects.  The `packages.config` file created at your project root will make sure that you pull and install the right packages and assets with a simple `Update-Package -Reinstall` from the NuGet Package Manager Console in Visual Studio.

# Final Thoughts #

I do recognize that Unity3D has an [Assert Workflow](https://docs.unity3d.com/Manual/AssetWorkflow.html) that is cross platform and is probably how they intend people to install shared assets and code.  My biggest problem with this workflow is the inability to uninstall packages once installed.  NuGet also is not supported out of the box by MonoDevelop and working with packages on OS X will probably pop up more issues (like running a Powershell Uninstall script).  However, with all that the NuGet package manager can provide with installing, updating, uninstalling, and more, it is not a technology I wanted to rule out when working with Unity3D in Visual Studio.

This workflow is definitely a work in progress.
