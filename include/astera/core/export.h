#ifndef ASTERA_CORE_EXPORT_H
#define ASTERA_CORE_EXPORT_H

#ifdef ASTERA_STATIC_DEFINE
#  define ASTERA_EXPORT
#  define ASTERA_NO_EXPORT
#else
#  ifndef ASTERA_EXPORT
#    ifdef astera_core_EXPORTS
#      define ASTERA_EXPORT __attribute__((visibility("default")))
#    else
#      define ASTERA_EXPORT
#    endif
#  endif
#  ifndef ASTERA_NO_EXPORT
#    define ASTERA_NO_EXPORT __attribute__((visibility("hidden")))
#  endif
#endif

#endif // ASTERA_CORE_EXPORT_H
