---
title: Creating a thread in Unity
date_created: 2016/08/06
category: Unity
short_link: CatiU
image: unity.png
---

**NOTE** (2020/02/05): the [Unity Job System](https://docs.unity3d.com/Manual/JobSystemOverview.html) is probably the way to do this now.  I'm keeping this post here for archival purposes or if someone really wants to do it old school.

## Motivation

While working on procedural mesh generation in Unity, I wanted to have an independent thread that could generate meshes in without hogging my main game loop. Also, I wanted to be able to utilize this thread when the game is not running and in the editor.

The following is the pattern I follow for sending work off the main game thread to a thread waiting to do work.

## Thread MonoBehaviour

The first thing that needs to be setup is a MonoBehaviour that can launch a thread:

{data-language=csharp}
```
using UnityEngine;
using System.Threading;
using ThreadPriority = System.Threading.ThreadPriority;


public class ExampleThread : MonoBehaviour
{
    private static Thread _threadInstance;

    private static ThreadWorker _worker;

    public static ThreadWorker Worker
    {
        get { return _worker; }
        private set { _worker = value; }
    }

    public void Start()
    {
        // The thread doesn't need a transform, so don't bother showing it.
        transform.hideFlags = HideFlags.HideInInspector;
        
        StartThread();
    }

    public void OnApplicationQuit()
    {
        // If the application is running as the editor, when the user creates the game object
        // to run the thread, we don't want it shutting down the generator.
        if(!Application.isEditor)
        {
            Worker.Shutdown();
        }
    }
    
    public static void UpdateInEditor()
    {
        TargetObject[] targetObjects = FindObjectsOfType<TargetObject>();
        foreach(TargetObject targetObject in targetObjects)
        {
            targetObject.Update();
        }
    }

    public static void StartThread()
    {
        if(Worker == null)
        {
            Worker = ThreadWorker();
            _threadInstance = new Thread(new ThreadStart(Worker.Run))
            {
                Name = "ExampleThread",
                Priority = ThreadPriority.Lowest,
                IsBackground = true
            };
            _threadInstance.Start();
        }
    }
}
```

A review of what is going on:
 
 - The thread only needs to be created once, so it is created as a singleton.
 - `UpdateInEditor` will be referenced later to make sure that the `GameObject` in the editor still updates even when the game is not running. 
 - In `StartThread` a new thread is setup with a low priority and as a background thread.  The priority is just a preference, but I set mine to low to make sure it does not hog too much time from the main game thread.  Setting the thread up as a background thread means it will get cleaned up when the main game thread closes.

 When building a game outside of the editor, a `GameObject` must be created with the a `ExampleThread` component added to it.  Otherwise, Unity will not know to start it!  

## Thread Worker 

Now that a thread is going, it is time to put it to work.  In this example, I'll work with a `Dictionary` in a thread safe way:

{data-language=csharp}
```
using System.Collections.Generic;
using System.Threading;

public class TheadWorker
{
    private readonly object _workLocker = new object();
    private readonly object _dictionaryLocker = new object();

    private readonly Dictionary<string, string> _workToDo = new
    private readonly Dictionary<string, string> _completedWork = new Dictionary<string, Vector3>;

    /// <summary>
    /// Main runner for thread
    /// </summary>
    public void Run()
    {
        string workId; 
        string workString;
        while(true)
        {
            try
            {                
                // Get a lock
                lock(_workLocker)
                {
                    // While there is nothing to do wait for a pulse
                    while(_workToDo.Count == 0)
                    {
                        Monitor.Wait(_workLocker);
                    }

                    // Lock the dictionary while we try to get some work from it
                    lock(_dictionaryLocker)
                    {
                        // If an "Exit" key exists, time to stop the thread
                        if(_workToDo.Keys.Contains("Exit"))
                        {
                            return;
                        }

                        // Get a piece of work from the work dictionary
                        workId = _workToDo.Keys.First();
                        workString = _workToDo[workId];
                        _workToDo.RemoveAt(workId);
                    }
                }

                // Do some work!  
                for(int i = 0; i < 10000; i++)
                {
                    int randNum = Random.Range(0, 26);
                    char randChar = (char)('a' + randNum);
                    workString += randChar;
                }

                // Lock the dictionary to store the result of the calculation
                lock(_dictionaryLocker)
                {
                    _completedWork.Add(workId, workString);
                }
            }
            catch(Exception e)
            {
                Debug.Log(e.Message);
                Debug.Log(e.StackTrace);
            }
        }
    }

    /// <summary>
    /// Signals to the thread it is time to shutdown
    /// </summary>
    public void Shutdown()
    {
        if(_completedWork != null)
        {
            lock(_dictionaryLocker)
            {
                _completedWork.Add("Exit", Vector3.zero);
            }
            
        }
    }

    /// <summary>
    /// Add work
    /// </summary>
    /// <param name="task"></param>
    public void AddWork(string workId, string workString)
    {
        lock(_dictionaryLocker)
        {
            _workToDo.Add(workId, workString);
            Monitor.Pulse(_workLocker);
        }
    }

    /// <summary>
    /// Get completed work
    /// </summary>
    public string GetCompletedWork(string workId)
    {
        string returnString;
        lock(_dictionaryLocker)
        {
            if(_completedWork.Keys.Contains(workId);
            {
                returnString = _completedWork[workId];
                _completedWork.RemoveAt(workId);
                return returnStrin
            }
            else
            {
                returnString = null;
            }
        }

        return returnString;
    }
}
```

Run down of the thread:

 - `Run()`
   - This method is an inifnite loop until the exit condition is met.  In this case a key of "Exit" will shutdown the loop.
   - To prevent this loop from running endlessly and freezing our main game loop, lock `_workLocker` and then wait for work to do with loop on the no work condition of `_workToDo.Count == 0`.
   - When there is work to do, lock `_dictionaryLocker` to ensure only this code is accessing the dictionaries. 
   - Do some work! 
   - When the work is done, lock `_dictionaryLocker` again to write to the `_completedWork`
   - Everything in the loop is surrounded by a `try`/`catch` to let us know of any errors in the loop.  If somethere were to happen, the default of Unity to log to the console will not happen because this is happening outside the main game loop.
 
 - `AddWork()` and `GetCompletedWork()` are ways we can access the dictionaries in the thread in a safe way.  These two methods are how we will interact with the thread from any `GameObject` that requies it.  In addition, `AddWork()` will also pulse our main thread our of the wait state to start working again.

## GameObject Example 

With the random letter appender worker running, a `GameObject` can now use this thread.  Here are example `Start` and `Update` methods:

{data-language=csharp}
```
public void Start()
{
    _workId = System.Guid.NewGuid().ToString();
    ExampleThread.Worker.AddWork(_workId, "Example");
}

public void Update()
{
    if(_workId == string.Empty)
    {
        return;
    }

    string result = ExampleThread.Worker.GetCompletedWork(_workId);
    if(result == null)
    {
        return;
    }
    Debug.Log(result);
}
```
# Threads and the Editor #

Working in harmony together, now the `GameObject` can get random strings from the thread all day long.  In the editor, there are a few more things that can be done to make everything work as expected. 

Make sure the following code is in the special `Editor` directory.  This will prevent this code from being brought over to a game build.

{data-language=csharp}
```
using UnityEngine;
using UnityEditor;

/// <summary>
/// Class to start the thread by default on Editor startup.
/// </summary>
[InitializeOnLoad]
public class VoxelMeshGeneratorThreadEditor : MonoBehaviour
{
    static VoxelMeshGeneratorThreadEditor()
    {
        ExampleThread.StartThread();
        EditorApplication.update += ExampleThread.UpdateInEditor;
    }
}
```
Explanation for what is going on here:
 
 - `[InitializeOnLoad]` – This will cause the static constructor `static StandaloneThread()` of the class to be called when the editor loads. Now a `GameObject` with the start thread component doesn't need to exist to work in the editor.  This is useful for threads that are only needed in the editor.
 - Adding our `UpdateInEditor` static method to the `EditorApplication.update` delegate allows us to update our `GameObject` even when the editor is not running the game. 


Enjoy running processor intensive tasks outside of your main game loop! One thing to note, you cannot mess with things inside the game loop in your separate thread (creating `GameObjects` for example), so keep that in mind.

To see an example in action, head over to the [Procedural Voxel Mesh](https://github.com/PixelsForGlory/ProceduralVoxelMesh) library on Github!

If you have any questions or comments, feel free to reach out [@afuzzyllama](https://www.twitter.com/afuzzyllama)

