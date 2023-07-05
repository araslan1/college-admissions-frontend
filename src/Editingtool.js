import Quill from "quill"
import "quill/dist/quill.snow.css" 
import { useState, useCallback, useEffect, useRef } from "react";
import "./Editingtool.css"; 
import { useParams } from "react-router-dom"; 
import { io } from 'socket.io-client';
import axios from 'axios';
import stick_figure from "./images/sleeping.png";
import clouds_figure from "./images/clouds.png"; 
import checkmark from "./images/checkmark.png"; 
import pinkstar from "./images/star.png"
import ConnectSocket from "./ConnectSocket";
import Cookies from "universal-cookie"; 
const cookies = new Cookies(); 
// get token generated on login
const token = cookies.get("TOKEN");


const Editingtool = () => {
    const [wordCount, setWordCount] = useState(0);
    const {id: documentId} = useParams(); //contains url id
    const [socket, setSocket] = useState(); 
    const [quill, setQuill] = useState(); 
    const [comments, setComments] = useState([]); 
    const SAVE_INTERVAL_MS =  50000; 
    const commentsRef = useRef(); 
    let span_tracker = null;
    let span_tracker_key = null; 
    let span_tracker_comment = null;


    useEffect(() => {
        const configuration = {
            method: 'get',
            url: `http://localhost:7470/auth-editingtool/${documentId}`,
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };
    
        axios(configuration)
            .then((response) => {
                console.log("hurray, given access to editing tool!")
            })
            .catch((error) => {
                console.log("you do not have access to editing tool")
                error = new Error(); 
            });
    }, []);

    const fetchComments = async () => {
        try {
            const configuration = {
                method: "get",
                url: `http://localhost:7470/comments/${documentId}`,
            };
            
            const response = await axios(configuration);
            setComments(response.data);
            console.log("Comments have been grabbed!")
        }
        catch (error) {
            console.log("Could not get comments", error);
        }
    }

    const loadComments =  () => {
        console.log("load comments called")
        let spans = document.querySelectorAll("div.ql-editor span");
        console.log(spans);
        spans.forEach((myspan, index) => {
            myspan.setAttribute("data-key", index);
            myspan.style.borderBottom = '2px solid #EA1537';
            myspan.style.paddingTop = "3.2px";
            myspan.style.paddingBottom = "3.2px";
            let find_comment_ref = () => {
                const comment = commentsRef.current.querySelector(`[data-key="${index}"]`);
                if (span_tracker){
                    span_tracker_comment.style.transform = 'none';
                    span_tracker = myspan;
                    span_tracker_key = index;
                    span_tracker_comment = comment;
                }else{
                    span_tracker = myspan;
                    span_tracker_key = index;
                    span_tracker_comment = comment;
                }
                console.log("CLICKED!");
                const textarea = comment.querySelector('.mycomments')
                if (textarea.style.display === "none"){
                    textarea.style.display ="initial"
                }
            
                comment.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                comment.style.transform = 'translateX(-15px) translateY(-8px)';
            }
            myspan.addEventListener('click', find_comment_ref);
        })
        
    }
    

    useEffect(() => {
        if (socket == null || quill == null) return; 
        if (socket){
            
            const interval = setInterval(() => {
                if (quill){
                    socket.emit("save-document", quill.getContents()); 
                }
                
            }, SAVE_INTERVAL_MS)

            return () => {
                clearInterval(interval); 
            }
        }
    
    }, [socket, quill])

    //this will check with our server if there is existing document
    //if there is update the content
    useEffect(() => {
        if (socket == null || quill == null) return; 

       
            // this will send to the server our documentID
            // if the documentId already exists it'll send the existing doc back to us
            socket.once("load-document", document => {
                
                quill.setContents(document);
                quill.enable(); //this is to enable text editor until document has loaded
                loadComments(); 
            })

            socket.emit('get-document', documentId); 

        

    }, [socket, quill, documentId]);


    //useEffect to connect to socket
    useEffect(() => {
    const s = io("http://localhost:7470")
    setSocket(s); 

        return () => {
            s.disconnect(); 
        }
    }, [])


    //use Effect for socket to receive changes
    useEffect(() => {
        if (socket === null || quill === null) return;
        const handler = (delta) => { 
            quill.updateContents(delta)
           
        };

        if (socket){
            socket.on("receive-changes",handler); 
        
            return () => {
                socket.off('receive-changes', handler); 
            }
        }
        
    }, [socket, quill])


    //useEffect for socket to emit changes once quill text-change occurs
    useEffect(() => {
        if (socket === null || quill === null) return;
        const handler = (delta, oldDelta, source) => { 
            //
            const text = quill.getText().trim();
            const words = text.split(/\s+/).filter((word) => word !== "");
            setWordCount(words.length);
            //
            if (source !== 'user') return; 
            socket.emit("send-changes", delta); 
        };

        if (quill){
            quill.on("text-change",handler); 
            quill.focus(); //mouse 
            return () => {
                quill.off('text-change', handler); 
            }
        }

    }, [socket, quill])

    const wrapperRef = useCallback((wrapper) => {
        if (wrapper == null) return; 
        wrapper.innerHTML = "";
        const editor = document.createElement('div');
        wrapper.append(editor);
        const q = new Quill(editor, { 
            theme: "snow",
            placeholder: "Type your prompt + response or paste (command+v)"
        }); 
        q.disable();
        q.setText("Loading..."); 
        fetchComments();
 
        setQuill(q); 
    
    }, [])



    

    const add_comment = () => {
        const selection = quill.getSelection();
        let selectedText = null;
        let overlap = false;
        if (selection){
            selectedText = quill.getText(selection.index, selection.length);

            for (let i = selection.index + selection.length -1; i >= selection.index; i--) {
                const format = quill.getFormat(i,1);
                if (format.background === '#fdb5c9'){
                    console.log("overlap detected");
                    console.log(quill.getText(i, 1));
                    overlap = true;
                }
            }
        }
        if (selectedText && !overlap){
            if (selectedText){
                quill.format('background', '#FDB5C9'); 
            }
            const selObj = window.getSelection();
            const selRange = selObj.getRangeAt(0);
    
        

            let span = null;
            if (span == null){
                if (selRange.commonAncestorContainer.parentElement.nodeName.toLowerCase() === 'span'){
                    span = selRange.commonAncestorContainer.parentElement;
                    console.log('Span Found!');
                    
                }
            }

            if (span == null){
                span = selRange.startContainer.nextSibling;
                console.log('Span Found!');
            }
            span.setAttribute("data-key", comments.length);
            let spans = document.querySelectorAll("div.ql-editor span");
            let my_index = null
            spans.forEach((myspan, index) => {
                span.style.borderBottom = '2px solid #EA1537';
                span.style.paddingTop = "3.2px";
                span.style.paddingBottom = "3.2px";
                const data_key = myspan.getAttribute("data-key")
                myspan.setAttribute("data-key", index);
                if (data_key.toString() === comments.length.toString()){
                    console.log(data_key)
                    console.log(comments.length)
                    my_index = index;
                }else{
                    var new_element = myspan.cloneNode(true);
                    myspan.parentNode.replaceChild(new_element, myspan);
                }
            })
            setComments([...comments.slice(0, my_index), `${comments.length}`, ...comments.slice(my_index)]);
            Promise.resolve().then(() => {
                spans = document.querySelectorAll("div.ql-editor span");
                spans.forEach((myspan, index) => {
                    let find_comment_ref = () => {
                        const comment = commentsRef.current.querySelector(`[data-key="${index}"]`);
                        if (span_tracker){
                            span_tracker_comment.style.transform = 'none';
                            span_tracker = myspan;
                            span_tracker_key = index;
                            span_tracker_comment = comment;
                        }else{
                            span_tracker = myspan;
                            span_tracker_key = index;
                            span_tracker_comment = comment;
                        }
                        console.log("CLICKED!")
                        const textarea = comment.querySelector('.mycomments')
                        if (textarea.style.display === "none"){
                            textarea.style.display ="initial"
                        }
                        comment.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                        comment.style.transform = 'translateX(-15px) translateY(-8px)';
                    }
                    myspan.addEventListener('click', find_comment_ref);
                })

               

                const commentDiv = commentsRef.current.querySelector(`[data-key="${my_index}"]`);
                console.log(commentDiv);
                const textarea = commentDiv.querySelector(".mycomments");
                if (textarea){
                    textarea.focus();
                }
            });

        }else if(overlap){
            window.alert("Please don't highlight an already existing comment when trying to add comments")
        }else{
            window.alert("Please select text to comment");
        }
    }
    
    const clear_formatting = () => {
        var length = quill.getLength()
        quill.removeFormat(0, length)
    }

    const save_comments = () => {
        try {
            const comments_config = {
                method: "post",
                url: "http://localhost:7470/comments",
                data: {
                    _id: documentId,
                    comments: comments,
                }
            }

            axios(comments_config)
                .then(() => {
                    console.log("comments were saved!");
                })
                .catch((error) => {
                    console.log("comments failed to save!");
                });
        }
        catch (error) {
            console.log("Could not save comment")
        }  
    }

    
    
    


    // useEffect( () => {
    //     fetchComments();
    // }, [])
 
    const print_spans =() => {
        let spans = document.querySelector("div.ql-editor span");
        console.log(spans);
    }

    return (
        <>
        <h1 className="documentName">Untitled Document</h1>
        <div className="testeditingtool">
            <div className="container" ref={wrapperRef}>

            </div>
            <div className="word-counter">{wordCount} words</div>

            <div className="commentscontainer" ref={commentsRef}>
                {comments.map((comment, index) => (
                    <div className="comment-box" key={index} data-key={index} 
                        onMouseDown={(e) => {
                            if (!e.currentTarget.querySelector(".select_tag").contains(e.target)){
                                console.log("ocurred"); 
                                const textarea = e.currentTarget.querySelector(".mycomments");
                                setTimeout(() => {if (textarea.style.display === "none"){
                                    console.log("switch from no display to display");
                                    textarea.style.display ="initial";
                                    textarea.focus(); 
                                }else if (document.activeElement !== textarea){
                                    // textarea.blur(); 
                                    textarea.style.display ="none";
                                }}, 0);
                            }
                        }}onBlur ={(e) => {
                            // if (!e.currentTarget.querySelector(".select_tag").contains(e.target)){
                            //     console.log("ocurred"); 
                            //     const textarea = e.currentTarget.querySelector(".mycomments");
                            //     textarea.style.display = "none";
                            // }
                        }}
                        
                            >
                        <div className="type-selection">
                            <img src={checkmark} alt="" className="checkmark_comment"></img>
                            <select className="select_tag">
                                <option>Grammar Suggestion</option>
                                <option>Content Suggestion</option>
                                <option></option>
                                <option>Other Suggestion</option>
                            </select>
                        </div>
                        
                        <textarea
                            value={comment} 
                            onChange={(e) => {
                                const new_comments = [...comments]; 
                                new_comments[index] = e.target.value;
                                setComments(new_comments);        
                            }}
                            className="mycomments"
                        ></textarea>
                    </div>
                ))}
            </div>

            

            {/* <img src={stick_figure} alt ="hello" id="mycartoon"></img>
            <img src={clouds_figure} alt="hello" id="clouds"></img>
            <p id="matchingmessage">Your essay has not been matched with a reviewer yet. Click here to be matched within seconds!</p> */}

            <div id ="sidenav">
                <button className="button-30" style = {{marginTop: "40px"}} onClick={clear_formatting}>Clear formatting</button>
                <button className="button-30" style = {{marginTop: "40px"}} onClick={add_comment}>Add comment</button>
                <button className="button-30" style = {{marginTop: "40px"}} onClick={save_comments}>completed</button>
                <button className="button-30" style = {{marginTop: "40px"}} onClick={print_spans}>Log Spans</button>
            </div> 
        </div>
        </>
    ); 
}   
 
export default Editingtool;