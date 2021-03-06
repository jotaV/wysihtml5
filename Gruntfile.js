module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd h:MM:ss") %> */\n'
      },
      build: {
        src: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
        dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.min.js'
      }
    },
    qunit: {
      all:['test/*.html']
    },
    shell: {
      make: {
	command:'make bundle'
      }
    },
    min : {
      dist:{
	src:['dist/<%= pkg.name %>-<%= pkg.version %>.js'],
	dest:'dist/<%= pkg.name %>-<%= pkg.version %>.min.js'
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-yui-compressor');
  grunt.loadNpmTasks('grunt-shell');
  
  grunt.registerTask('test', ['qunit']);
  grunt.registerTask('uglify', ['uglify']);
  grunt.registerTask('bundle', ['shell']);
  grunt.registerTask('minify', ['min']);
  grunt.registerTask('make', ['shell','min']);

  // Default task(s).
  grunt.registerTask('default', ['test', 'make']);


};
