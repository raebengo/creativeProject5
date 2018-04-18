<template>
  <div class="feed">
    <div>
      <form enctype="multipart/form-data" v-on:submit.prevent="pic" class="descForm">
        <div class="icon">
          <label for="file-input">
            <i class="far fa-image" aria-hidden="true"></i>
          </label>
          <input id="file-input" type="file" v-on:change="previewImage" accept="image/*" class="input-file">
        </div>
        <div v-bind:style="{inactive: !imagePreview, active:imagePreview }">
          <img class="preview" v-bind:src="imageData">
  <textarea v-model="text" placeholder=""/>
	</div>
	<div class="buttons">
	  <div class="buttonWrap">
	    <button class="primary" type="submit">Add Image</button>
	  </div>
	</div>
      </form>
      <div class="flexWrapper errorPlace">
        <p v-if="addError" class="flexRight error">{{addError}}</p>
      </div>
    </div>
    <feed-list v-bind:feed="feed" />
  </div>
</template>

<script>
 import FeedList from './FeedList';
 export default {
   name: 'UserFeed',
   data () {
     return {
       text: '',
       imageData: '',
       imagePreview: false,
       file: '',
       addError: '',
     }
   },
   components: { FeedList },
   computed: {
     feed: function() {
       return this.$store.getters.feed;
     },
     addError: function() {
       return this.$store.getters.addError;
     },
   },
   created: function() {
     this.$store.dispatch('getFeed');
   },
   methods: {
     pic: function() {
       this.addError = '';
       if(!this.file){
         this.addError = 'You need an image to upload';
       }
       this.$store.dispatch('addPic',{
         pic: this.text,
	 image: this.file,
   }).then(pic => {
  	 this.text = "";
  	 this.imageData = "";
  	 this.imagePreview = false;
   })
     },
     previewImage: function(event) {
       const input = event.target;
       if (input.files && input.files[0]) {
	 this.file = input.files[0];
         const reader = new FileReader();
         reader.onload = (e) => {
           this.imageData = e.target.result;
	   this.imagePreview = true;
         }
         reader.readAsDataURL(input.files[0]);
       }
     }
   }
 }
</script>

<style scoped>
 .descForm {
     background: #83677B;
     padding: 10px;
     margin-bottom: 10px;
 }
 .buttons {
     display: flex;
     justify-content: space-between;
 }
 .buttonWrap {
     width: 20%;
 }
 .icon {
    font-size: 3.5em;
    margin-left: 20px;
    color:white;
}
.icon:active {
    transform: translateY(4px);
}
 button {
     height: 2em;
     font-size: 0.9em;
     float:right;
 }
 textarea {
     width: 100%;
     height: 5em;
     padding: 2px;
     margin-bottom: 5px;
     resize: none;
     box-sizing: border-box;
 }
 input[type="file"] {
     display: none;
 }
 .imagePreview {
     padding: 0px;
     height: 150px;
 }
 active {
     display: block;
 }
 inactive {
     display: none;
 }
 img {
     max-width: 100%;
     max-height: 100%;
 }
</style>
