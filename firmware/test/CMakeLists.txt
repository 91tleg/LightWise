cmake_minimum_required(VERSION 3.16.0)

project(Tests LANGUAGES CXX C)
set(CMAKE_CXX_STANDARD 17)

enable_testing()

add_subdirectory(googletest)

function(add_native_test TEST_NAME SRC_FILES INCLUDE_DIRS)
    add_executable(${TEST_NAME} ${SRC_FILES})

    # Asan
    target_compile_options(${TEST_NAME} PRIVATE -fsanitize=address -fno-omit-frame-pointer)
    target_link_options(${TEST_NAME} PRIVATE -fsanitize=address -fno-omit-frame-pointer)

    target_include_directories(${TEST_NAME} PRIVATE ${INCLUDE_DIRS})
    target_link_libraries(${TEST_NAME} PRIVATE gmock gtest_main)

    add_test(NAME ${TEST_NAME} COMMAND ${TEST_NAME})
endfunction()

file(GLOB_RECURSE TEST_FILES
    "${CMAKE_CURRENT_SOURCE_DIR}/lib/test_*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/modules/test_*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/common/utils/test_*.cpp" 
)

foreach(TEST_FILE ${TEST_FILES})
    get_filename_component(TEST_FILENAME ${TEST_FILE} NAME_WE)
    string(REPLACE "test_" "" MODULE_NAME ${TEST_FILENAME})

    set(CANDIDATES "")
    set(POSSIBLE_SRC
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/modules/${MODULE_NAME}/${MODULE_NAME}.cpp"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/modules/${MODULE_NAME}/${MODULE_NAME}.c"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/lib/${MODULE_NAME}/${MODULE_NAME}.cpp"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/lib/${MODULE_NAME}/${MODULE_NAME}.c"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/lib/${MODULE_NAME}.cpp"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/lib/${MODULE_NAME}.c"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/common/utils/${MODULE_NAME}.c"
    )

    foreach(SRC ${POSSIBLE_SRC})
        if(EXISTS ${SRC})
            # Skip HAL sources if a mock exists
            get_filename_component(SRC_NAME ${SRC} NAME)
            if(SRC_NAME MATCHES "^hal_.*\\.c$")
                # check if a mock exists
                set(MOCK_HEADER "${CMAKE_CURRENT_SOURCE_DIR}/mocks/hal/${SRC_NAME}.h")
                if(EXISTS ${MOCK_HEADER})
                    message(STATUS "Mock found for ${SRC_NAME}")
                else()
                    list(APPEND CANDIDATES ${SRC})
                endif()
            else()
                list(APPEND CANDIDATES ${SRC})
            endif()
        endif()
    endforeach()

    if(NOT CANDIDATES)
        message(WARNING "No source found for test ${TEST_FILE}, skip")
        continue()
    endif()

    set(INCLUDE_DIRS
        "${CMAKE_CURRENT_SOURCE_DIR}/mocks"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/modules/${MODULE_NAME}"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/lib/${MODULE_NAME}"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/lib"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src/common" 
    )

    add_native_test(${TEST_FILENAME} "${CANDIDATES};${TEST_FILE}" "${INCLUDE_DIRS}")
endforeach()
