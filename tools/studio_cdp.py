#!/usr/bin/env python3
"""studio_cdp.py eval 'JS' | files SELECTOR_INDEX path... | nav URL  — CDP na aba do Tripo Studio da bancada."""
import sys, json, time, subprocess, urllib.request, websocket
port = json.loads(subprocess.run(["agent-bench","cdp","dailywork-campanhas"],capture_output=True,text=True).stdout)["port"]
tabs=[t for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json")) if t.get("type")=="page" and "studio.tripo3d.ai" in t.get("url","")]
ws=websocket.create_connection(tabs[0]["webSocketDebuggerUrl"],timeout=120,suppress_origin=True)
n=0
def call(m,p=None):
    global n; n+=1; ws.send(json.dumps({"id":n,"method":m,"params":p or {}}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==n: return r
def ev(js):
    r=call("Runtime.evaluate",{"expression":js,"awaitPromise":True,"returnByValue":True})
    return r.get("result",{}).get("result",{}).get("value", r)
cmd=sys.argv[1]
if cmd=="eval": print(json.dumps(ev(sys.argv[2]),ensure_ascii=False)[:4000])
elif cmd=="nav": call("Page.navigate",{"url":sys.argv[2]}); time.sleep(6); print(ev("location.href"))
elif cmd=="files":
    idx=int(sys.argv[2]); paths=sys.argv[3:]
    doc=call("DOM.getDocument",{"depth":-1,"pierce":True})["result"]["root"]["nodeId"]
    ids=call("DOM.querySelectorAll",{"nodeId":doc,"selector":"input[type=file]"})["result"]["nodeIds"]
    nid=ids[idx]; call("DOM.setFileInputFiles",{"nodeId":nid,"files":paths})
    obj=call("DOM.resolveNode",{"nodeId":nid})["result"]["object"]["objectId"]
    call("Runtime.callFunctionOn",{"objectId":obj,"functionDeclaration":"function(){this.dispatchEvent(new Event('change',{bubbles:true}));this.dispatchEvent(new Event('input',{bubbles:true}))}"})
    print("ok", len(ids), "inputs")
elif cmd=="shot":
    import base64; r=call("Page.captureScreenshot",{"format":"jpeg","quality":60}); open(sys.argv[2],"wb").write(base64.b64decode(r["result"]["data"])); print("ok")
elif cmd=="type":  # type CSS_SELECTOR_JS_EXPR_RETURNING_ELEMENT text
    ev(f"(()=>{{const e={sys.argv[2]};e.focus();e.select&&e.select();return 1}})()")
    call("Input.insertText",{"text":sys.argv[3]})
    for t in ("keyDown","keyUp"): call("Input.dispatchKeyEvent",{"type":t,"key":"Enter","code":"Enter","windowsVirtualKeyCode":13})
    print(ev(f"({sys.argv[2]}).value"))
elif cmd=="ws":  # entra no workspace pela home (navegação direta quebra) e fecha popup
    call("Page.navigate",{"url":"https://studio.tripo3d.ai/"}); time.sleep(6)
    ev('[...document.querySelectorAll("a")].find(a=>a.href.includes("workspace/generate")).click()'); time.sleep(8)
    print(ev('(()=>{const b=[...document.querySelectorAll("*")].find(e=>e.childElementCount==0&&e.innerText&&e.innerText.trim()=="Maybe Later");b&&b.click();return location.href})()'))
elif cmd=="click":
    x,y=float(sys.argv[2]),float(sys.argv[3]); cnt=int(sys.argv[4]) if len(sys.argv)>4 else 1
    for t in ("mouseMoved","mousePressed","mouseReleased"):
        call("Input.dispatchMouseEvent",{"type":t,"x":x,"y":y,"button":"left","clickCount":cnt})
    print("ok")
